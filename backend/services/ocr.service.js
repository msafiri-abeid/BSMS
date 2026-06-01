// services/ocr.service.js
const vision = require('@google-cloud/vision');

let client;
try {
  client = new vision.ImageAnnotatorClient();
} catch (e) {
  console.warn('Google Vision not configured:', e.message);
}

const extractMeterReading = async (imageBuffer, manufacturer) => {
  if (!client) {
    return { success: false, error: 'OCR service not configured', extractedValues: null };
  }

  try {
    const [result] = await client.textDetection({ image: { content: imageBuffer } });
    const rawText = result.fullTextAnnotation?.text || '';
    const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;

    if (manufacturer === 'Meteora' || manufacturer === 'EGT') {
      // Extract CREDIT counter number - look for a large number near "CREDIT" keyword
      const creditMatch = rawText.match(/CREDIT[:\s]*([0-9,]+)/i) ||
                          rawText.match(/([0-9]{4,})/);
      const creditValue = creditMatch ? parseInt(creditMatch[1].replace(/,/g, '')) : null;
      return {
        success: !!creditValue,
        extractedValues: { credit_count: creditValue },
        confidence: confidence || 0.9,
        rawText,
        needsConfirmation: confidence < 0.8,
      };
    }

    if (manufacturer === 'Novomatic') {
      // Extract TOTAL IN and TOTAL OUT from master accounting screen
      const totalInMatch = rawText.match(/TOTAL\s*IN[:\s]*([0-9,]+)/i);
      const totalOutMatch = rawText.match(/TOTAL\s*OUT[:\s]*([0-9,]+)/i);
      const totalIn = totalInMatch ? parseInt(totalInMatch[1].replace(/,/g, '')) : null;
      const totalOut = totalOutMatch ? parseInt(totalOutMatch[1].replace(/,/g, '')) : null;
      return {
        success: !!(totalIn !== null && totalOut !== null),
        extractedValues: { total_in: totalIn, total_out: totalOut },
        confidence: confidence || 0.9,
        rawText,
        needsConfirmation: confidence < 0.8 || !totalIn || !totalOut,
      };
    }

    return { success: false, error: 'Unknown manufacturer', extractedValues: null };
  } catch (err) {
    console.error('OCR error:', err);
    return { success: false, error: err.message, extractedValues: null };
  }
};

module.exports = { extractMeterReading };
