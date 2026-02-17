const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Template = require('../models/Template');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/templates ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? {}
      : { $or: [{ createdBy: req.user._id }, { isPublic: true }] };

    const templates = await Template.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: templates.length, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/templates ──────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('category').optional().isIn([
      'Smart Agriculture', 'Fire Monitoring', 'Industrial Safety',
      'Carbon Emission Tracking', 'Environmental Monitoring', 'Custom',
    ]),
    body('hardwareType').optional().isIn(['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Other']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, description, category, hardwareType, isPublic, defaultPins } = req.body;

      const template = await Template.create({
        name,
        description,
        category: category || 'Custom',
        hardwareType: hardwareType || 'ESP32',
        isPublic: isPublic || false,
        defaultPins: defaultPins || [],
        createdBy: req.user._id,
      });

      res.status(201).json({ success: true, message: 'Template created.', template });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── GET /api/templates/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { templateId: req.params.id },
      ],
    }).populate('createdBy', 'name email');

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    // Check access
    if (!template.isPublic && template.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── PUT /api/templates/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { templateId: req.params.id },
      ],
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    if (template.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { name, description, category, hardwareType, isPublic, defaultPins } = req.body;
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (category) template.category = category;
    if (hardwareType) template.hardwareType = hardwareType;
    if (isPublic !== undefined) template.isPublic = isPublic;
    if (defaultPins) template.defaultPins = defaultPins;

    await template.save();
    res.json({ success: true, message: 'Template updated.', template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/templates/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { templateId: req.params.id },
      ],
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    if (template.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await template.deleteOne();
    res.json({ success: true, message: 'Template deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
