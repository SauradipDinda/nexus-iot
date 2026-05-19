const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../db/prisma');
const { protect } = require('../middleware/auth');

router.use(protect);

const formatTemplate = (t) => ({
  ...t,
  _id: t.id,
  createdBy: t.user ? { _id: t.createdBy, name: t.user.name, email: t.user.email } : t.createdBy,
});

// ─── GET /api/templates ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const where = req.user.role === 'admin'
      ? {}
      : { OR: [{ createdBy: req.user.id }, { isPublic: true }] };

    const templates = await prisma.template.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: templates.length, templates: templates.map(formatTemplate) });
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

      const template = await prisma.template.create({
        data: {
          name,
          description,
          category: category || 'Custom',
          hardwareType: hardwareType || 'ESP32',
          isPublic: isPublic || false,
          defaultPins: defaultPins || [],
          createdBy: req.user.id,
        },
        include: { user: { select: { name: true, email: true } } },
      });

      res.status(201).json({ success: true, message: 'Template created.', template: formatTemplate(template) });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── GET /api/templates/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findFirst({
      where: { OR: [{ id }, { templateId: id }] },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    if (!template.isPublic && template.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, template: formatTemplate(template) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── PUT /api/templates/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findFirst({
      where: { OR: [{ id }, { templateId: id }] },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }
    if (template.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { name, description, category, hardwareType, isPublic, defaultPins } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (hardwareType) updateData.hardwareType = hardwareType;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (defaultPins) updateData.defaultPins = defaultPins;

    const updated = await prisma.template.update({
      where: { id: template.id },
      data: updateData,
      include: { user: { select: { name: true, email: true } } },
    });

    res.json({ success: true, message: 'Template updated.', template: formatTemplate(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/templates/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findFirst({
      where: { OR: [{ id }, { templateId: id }] },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }
    if (template.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await prisma.template.delete({ where: { id: template.id } });
    res.json({ success: true, message: 'Template deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
