const express = require('express');
const reviewService = require('../services/reviewService');
const NLPEngine = require('../nlp/NLPEngine');

const router = express.Router();
const nlp = new NLPEngine();

const SENTIMENT_LABELS = ['Happy', 'Angry', 'Neutral'];

function validateReviewInput(body) {
  const fields = {};
  const productName = typeof body?.productName === 'string' ? body.productName.trim() : '';
  const customerName = typeof body?.customerName === 'string' ? body.customerName.trim() : '';
  const reviewText = typeof body?.reviewText === 'string' ? body.reviewText.trim() : '';

  if (!productName) fields.productName = 'Product name is required';
  else if (productName.length > 100)
    fields.productName = 'Product name must be 100 characters or fewer';

  if (!customerName) fields.customerName = 'Customer name is required';
  else if (customerName.length > 100)
    fields.customerName = 'Customer name must be 100 characters or fewer';

  if (!reviewText) fields.reviewText = 'Review text is required';
  else if (reviewText.length < 3) fields.reviewText = 'Review text must be at least 3 characters';
  else if (reviewText.length > 5000)
    fields.reviewText = 'Review text must be 5000 characters or fewer';

  return { fields, productName, customerName, reviewText };
}

router.get('/', async (req, res, next) => {
  try {
    const { sentiment, productID } = req.query;

    if (sentiment && !SENTIMENT_LABELS.includes(sentiment)) {
      return res.status(400).json({ error: 'Invalid sentiment filter' });
    }

    const result = await reviewService.listReviews({
      limit: req.query.limit,
      offset: req.query.offset,
      sentiment,
      productID: productID ? Number.parseInt(productID, 10) : undefined,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { fields, productName, customerName, reviewText } = validateReviewInput(req.body);

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fields });
    }

    const review = await reviewService.createReview({ productName, customerName, reviewText });

    const { label, confidence } = nlp.analyse(reviewText);
    await reviewService.saveSentimentResult(review.reviewID, label, confidence);

    const created = await reviewService.getReview(review.reviewID);

    return res.status(201).json({
      reviewID: created.reviewID,
      productName: created.productName,
      customerName: created.customerName,
      reviewText: created.reviewText,
      sentimentLabel: created.sentimentLabel,
      confidenceScore: created.confidenceScore,
      dateSubmitted: created.dateSubmitted,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
