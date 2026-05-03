import { Router, Response } from 'express';
import Session from '../models/Session';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware';
import { sendPush } from '../services/pushService';

const router = Router();
router.use(protect);

// POST /api/sessions — Student creates pre-visit request
router.post('/', restrictTo('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { belongings } = req.body;
    const session = await Session.create({
      student: req.user!._id,
      belongings: belongings || [],
      status: 'pending',
    });
    await session.populate('student', 'name email rollNumber department');
    res.status(201).json({ session });
  } catch (err) {
    res.status(400).json({ message: 'Failed to create session', error: err });
  }
});

// GET /api/sessions/mine — Student's own sessions
router.get('/mine', restrictTo('student'), async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ student: req.user!._id })
      .populate('guard', 'name')
      .sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/pending — Guard: pending entry requests
router.get('/pending', restrictTo('guard'), async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ status: 'pending' })
      .populate('student', 'name email rollNumber department')
      .sort({ createdAt: 1 });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending sessions' });
  }
});

// GET /api/sessions/active — Guard: live occupancy
router.get('/active', restrictTo('guard'), async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ status: { $in: ['active', 'exiting'] } })
      .populate('student', 'name email rollNumber department')
      .sort({ entryTime: -1 });
    res.json({ sessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch active sessions' });
  }
});

// GET /api/sessions — Guard: all records (searchable)
router.get('/', restrictTo('guard'), async (req: AuthRequest, res: Response) => {
  try {
    const { q, status, date } = req.query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};
    if (status) filter.status = status;
    if (date) {
      const start = new Date(date as string);
      const end = new Date(date as string);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    let sessions = await Session.find(filter)
      .populate('student', 'name email rollNumber department')
      .populate('guard', 'name')
      .sort({ createdAt: -1 })
      .limit(200);

    if (q) {
      const qs = (q as string).toLowerCase();
      sessions = sessions.filter((s) => {
        const st = s.student as any;
        return (
          st?.name?.toLowerCase().includes(qs) ||
          st?.rollNumber?.toLowerCase().includes(qs) ||
          st?.email?.toLowerCase().includes(qs)
        );
      });
    }
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch records' });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('student', 'name email rollNumber department')
      .populate('guard', 'name');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// PUT /api/sessions/:id/entry — Guard approves entry
router.put('/:id/entry', restrictTo('guard'), async (req: AuthRequest, res: Response) => {
  try {
    // Find first to capture studentId before populate replaces the ObjectId
    const raw = await Session.findById(req.params.id);
    if (!raw) return res.status(404).json({ message: 'Session not found' });
    const studentId = raw.student.toString();

    raw.status = 'active';
    raw.entryTime = new Date();
    raw.guard = req.user!._id as any;
    await raw.save();
    await raw.populate('student', 'name email rollNumber department');

    // Send push in background — never let it fail the response
    sendPush(studentId, '✅ Library Entry Confirmed', 'Your entry has been approved. Tap to acknowledge.').catch(console.error);
    res.json({ session: raw });
  } catch (err) {
    console.error('Entry error:', err);
    res.status(500).json({ message: 'Failed to approve entry' });
  }
});

// PUT /api/sessions/:id/belongings — Student edits belongings
router.put('/:id/belongings', restrictTo('student'), async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, student: req.user!._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!['pending', 'active'].includes(session.status)) {
      return res.status(400).json({ message: 'Cannot edit belongings at this stage' });
    }
    session.belongings = req.body.belongings;
    await session.save();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update belongings' });
  }
});

// PUT /api/sessions/:id/exit — Guard initiates exit check
router.put('/:id/exit', restrictTo('guard'), async (req: AuthRequest, res: Response) => {
  try {
    const raw = await Session.findById(req.params.id);
    if (!raw) return res.status(404).json({ message: 'Session not found' });
    const studentId = raw.student.toString();

    raw.status = 'exiting';
    await raw.save();
    await raw.populate('student', 'name email rollNumber department');

    sendPush(studentId, '🚪 Library Exit Request', 'The guard is checking your exit. Tap to confirm your belongings and exit.').catch(console.error);
    res.json({ session: raw });
  } catch (err) {
    console.error('Exit error:', err);
    res.status(500).json({ message: 'Failed to initiate exit' });
  }
});

// PUT /api/sessions/:id/exit-confirm — Student confirms exit
router.put('/:id/exit-confirm', restrictTo('student'), async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, student: req.user!._id, status: 'exiting' },
      { status: 'completed', exitTime: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found or not in exiting state' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Failed to confirm exit' });
  }
});

// PUT /api/sessions/:id/flag — Guard flags mismatch
router.put('/:id/flag', restrictTo('guard'), async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { status: 'flagged', flagNotes: req.body.flagNotes || 'Belongings mismatch' },
      { new: true }
    ).populate('student', 'name email rollNumber department');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Failed to flag session' });
  }
});

export default router;
