import crypto from "crypto";

export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// create signature
// const payload = JSON.stringify(data);
// const signature = crypto
//   .createHmac('sha256', secret)
//   .update(payload)
//   .digest('hex');

// fetch('your-webhook-url', {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'X-Signature': signature
//   },
//   body: payload
// });


