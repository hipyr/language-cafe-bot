export const normalizeMatchMatchText = (value) => value.toUpperCase().replace(/[\s-]+/g, '');

export const isSubmissionForTopic = (submission, topic) =>
  normalizeMatchMatchText(submission).includes(normalizeMatchMatchText(topic));
