var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

router.use('/ai', require('./ai'));
router.use('/regionSearch', require('./region_search'));
router.use('/user', require('./user'));
router.use('/travelCourse', require('./travel_course'));
router.use('/post', require('./post'));
router.use('/manageTravel', require('./manage_travel'));
router.use('/managePost', require('./manage_post'));
router.use('/manageNetwork', require('./manage_network'));
router.use('/manageUser', require('./manage_user'));
router.use('/marketing', require('./marketing'));
router.use('/inquiry', require('./inquiry'));
router.use('/notice', require('./notice'));
router.use('/place', require('./place'));
router.use('/event', require('./event'));
router.use('/regionSearchLog', require('./region_search_log'));
router.use('/hikingSearch', require('./hiking_search'));
router.use('/news', require('./news'));
router.use('/sellingProduct', require('./selling_product'));

module.exports = router;
