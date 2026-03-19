const express = require('express');
const { User, Store, Medicine, Inventory, AuditLog, StockRequest } = require('../models');
const { authenticateJWT, requireRole } = require('../middleware/security');
const router = express.Router();

router.use(authenticateJWT, requireRole('admin'));

router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalStores, pendingStores, totalMedicines, recentLogs] = await Promise.all([
      User.countDocuments(),
      Store.countDocuments(),
      Store.countDocuments({ isVerified: false }),
      Medicine.countDocuments({ isActive: true }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actorId', 'email role').lean(),
    ]);
    res.json({ totalUsers, totalStores, pendingStores, totalMedicines, recentLogs });
  } catch (err) { next(err); }
});

router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = search ? { email: { $regex: search, $options: 'i' } } : {};
    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean(),
      User.countDocuments(query),
    ]);
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['patient', 'pharmacist', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    await AuditLog.create({ actorId: req.user.id, action: 'ROLE_CHANGE', ipAddress: req.ip, outcome: 'success', metadata: { targetId: req.params.id, newRole: role } });
    res.json({ message: 'Role updated', user });
  } catch (err) { next(err); }
});

router.patch('/users/:id/ban', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const banned = user.lockedUntil && user.lockedUntil > new Date();
    const update = banned ? { lockedUntil: null } : { lockedUntil: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) };
    await User.findByIdAndUpdate(req.params.id, update);
    await AuditLog.create({ actorId: req.user.id, action: banned ? 'USER_UNBAN' : 'USER_BAN', ipAddress: req.ip, outcome: 'success', metadata: { targetId: req.params.id } });
    res.json({ message: banned ? 'User unbanned' : 'User banned' });
  } catch (err) { next(err); }
});

router.get('/stores', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, verified } = req.query;
    const query = verified !== undefined ? { isVerified: verified === 'true' } : {};
    const [stores, total] = await Promise.all([
      Store.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean(),
      Store.countDocuments(query),
    ]);
    res.json({ stores, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.patch('/stores/:id/verify', async (req, res, next) => {
  try {
    const { approve } = req.body;
    const store = await Store.findByIdAndUpdate(req.params.id, { isVerified: !!approve }, { new: true });
    if (!store) return res.status(404).json({ error: 'Store not found' });
    await AuditLog.create({ actorId: req.user.id, action: approve ? 'STORE_APPROVED' : 'STORE_REJECTED', ipAddress: req.ip, outcome: 'success', metadata: { storeId: req.params.id, storeName: store.name } });
    res.json({ message: approve ? 'Store approved' : 'Store rejected', store });
  } catch (err) { next(err); }
});

router.delete('/stores/:id', async (req, res, next) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    await Inventory.deleteMany({ storeId: req.params.id });
    await AuditLog.create({ actorId: req.user.id, action: 'STORE_DELETED', ipAddress: req.ip, outcome: 'success', metadata: { storeId: req.params.id, storeName: store.name } });
    res.json({ message: 'Store deleted' });
  } catch (err) { next(err); }
});

router.get('/medicines', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const [medicines, total] = await Promise.all([
      Medicine.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean(),
      Medicine.countDocuments(query),
    ]);
    res.json({ medicines, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.post('/medicines', async (req, res, next) => {
  try {
    const { name, genericName, category, manufacturer, requiresPrescription } = req.body;
    if (!name || !genericName || !category || !manufacturer)
      return res.status(400).json({ error: 'All fields required' });
    const medicine = await Medicine.create({
      name, genericName, category, manufacturer,
      requiresPrescription: !!requiresPrescription,
      isActive: true,
      createdBy: req.user.id,
    });
    await AuditLog.create({ actorId: req.user.id, action: 'MEDICINE_ADDED', ipAddress: req.ip, outcome: 'success', metadata: { medicineId: medicine._id, name } });
    res.status(201).json({ message: 'Medicine added', medicine });
  } catch (err) { next(err); }
});

router.patch('/medicines/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'genericName', 'category', 'manufacturer', 'requiresPrescription', 'isActive'];
    const update = {};
    for (const key of allowed) { if (req.body[key] !== undefined) update[key] = req.body[key]; }
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    await AuditLog.create({ actorId: req.user.id, action: 'MEDICINE_UPDATED', ipAddress: req.ip, outcome: 'success', metadata: { medicineId: req.params.id, update } });
    res.json({ message: 'Medicine updated', medicine });
  } catch (err) { next(err); }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action = '' } = req.query;
    const query = action ? { action: { $regex: action, $options: 'i' } } : {};
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).populate('actorId', 'email role').skip((page - 1) * limit).limit(parseInt(limit)).lean(),
      AuditLog.countDocuments(query),
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/health', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      db: dbState[mongoose.connection.readyState],
      memory: process.memoryUsage(),
      node: process.version,
      env: process.env.NODE_ENV,
      timestamp: new Date(),
    });
  } catch (err) { next(err); }
});

// ── Stock Requests ─────────────────────────────────────────

router.get("/stock-requests", async (req, res, next) => {
  try {
    const { status = "pending", page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const requests = await StockRequest.find({ status })
      .populate("storeId", "name address")
      .populate("submittedBy", "email")
      .populate("items.medicineId", "name genericName")
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit)).lean();
    const total = await StockRequest.countDocuments({ status });
    res.json({ requests, total });
  } catch (err) { next(err); }
});

router.patch("/stock-requests/:id/review", async (req, res, next) => {
  try {
    const { items, adminNote } = req.body;
    const request = await StockRequest.findById(req.params.id).populate("storeId");
    if (!request) return res.status(404).json({ error: "Request not found" });

    let approvedCount = 0;
    let rejectedCount = 0;

    for (const review of items) {
      const item = request.items.id(review.itemId);
      if (!item) continue;

      if (review.action === "approve" && item.status === "pending") {
        item.status = "approved";

        let medicineId = item.medicineId;

        // If not in DB, create the medicine first
        if (!medicineId) {
          const newMed = await Medicine.create({
            name:                 item.extractedName,
            genericName:          item.extractedName,
            category:             "other",
            isActive:             true,
            manufacturer:         "Unknown",
            dosageForms:          [],
            requiresPrescription: false,
             createdBy:            req.user.id,
          });
          medicineId = newMed._id;
          item.medicineId = medicineId;
          await AuditLog.create({
            actorId: req.user.id, action: "MEDICINE_ADDED", ipAddress: req.ip,
            outcome: "success",
            metadata: { medicineId: newMed._id, name: item.extractedName, source: "stock_approval" },
          });
        }

        const qty   = Math.min(Math.max(parseInt(review.quantity || item.quantity), 0), 99999);
        const price = Math.min(Math.max(parseFloat(review.price || item.price), 0), 99999);

        const existing = await Inventory.findOne({ storeId: request.storeId._id, medicineId });
        if (existing) {
          await Inventory.updateOne(
            { _id: existing._id },
            { $inc: { quantity: qty }, $set: { price: price || existing.price, inStock: true } }
          );
        } else {
          await Inventory.create({
            storeId: request.storeId._id, medicineId,
            quantity: qty, price, inStock: qty > 0,
          });
        }
        approvedCount++;

      } else if (review.action === "reject") {
        item.status = "rejected";
        rejectedCount++;
      }
    }

    const allReviewed = request.items.every(i => i.status !== "pending");
    if (allReviewed) {
      const hasApproved  = request.items.some(i => i.status === "approved");
      const hasRejected  = request.items.some(i => i.status === "rejected");
      request.status     = hasApproved && hasRejected ? "partial" : hasApproved ? "approved" : "rejected";
      request.reviewedBy = req.user.id;
      request.reviewedAt = new Date();
      request.adminNote  = adminNote || "";
    }

    await request.save();

    await AuditLog.create({
      actorId: req.user.id, action: "ADMIN_ACTION", ipAddress: req.ip,
      outcome: "success",
      metadata: { action: "stock_request_review", requestId: req.params.id, approvedCount, rejectedCount },
    });

    res.json({ message: `Reviewed: ${approvedCount} approved, ${rejectedCount} rejected`, request });
  } catch (err) { next(err); }
});

// Delete single user
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await AuditLog.create({ actorId: req.user.id, action: 'ADMIN_ACTION', ipAddress: req.ip, outcome: 'success', metadata: { action: 'user_deleted', targetId: req.params.id, email: user.email } });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// Delete single medicine
router.delete('/medicines/:id', async (req, res, next) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    await Inventory.deleteMany({ medicineId: req.params.id });
    await AuditLog.create({ actorId: req.user.id, action: 'ADMIN_ACTION', ipAddress: req.ip, outcome: 'success', metadata: { action: 'medicine_deleted', medicineId: req.params.id, name: medicine.name } });
    res.json({ message: 'Medicine deleted' });
  } catch (err) { next(err); }
});

module.exports = router;