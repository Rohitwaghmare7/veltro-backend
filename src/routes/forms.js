const express = require('express');
const router = express.Router();
const { protect, setBusinessContext, authorizeStaff } = require('../middleware/auth');
const {
    getForms,
    getFormById,
    createForm,
    updateForm,
    deleteForm,
    getSubmissions,
    getPublicForm,
    submitForm
} = require('../controllers/formController');

// Public routes
router.get('/public/:id', getPublicForm);
router.post('/public/:id/submit', submitForm);

// Protected routes
router.use(protect);
router.use(setBusinessContext);
router.use(authorizeStaff(['canEditBookings', 'canEditLeads']));

router.route('/')
    .get(getForms)
    .post(createForm);

router.route('/:id')
    .get(getFormById)
    .put(updateForm)
    .delete(deleteForm);

router.get('/:id/submissions', getSubmissions);

module.exports = router;
