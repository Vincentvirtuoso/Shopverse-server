export const calculateAverageOrderAge = (orders = []) => {
  if (!orders.length) return 0;

  const now = Date.now();

  const totalAgeMs = orders.reduce((total, order) => {
    if (!order?.dates?.placedAt) return total;

    const placedAt = new Date(order.dates.placedAt).getTime();
    return total + (now - placedAt);
  }, 0);

  const averageAgeMs = totalAgeMs / orders.length;

  const averageAgeDays = averageAgeMs / (1000 * 60 * 60 * 24);

  return Number(averageAgeDays.toFixed(2));
};

export const getDateRange = (timeframe = "30d") => {
  const now = new Date();
  let start;

  const daysMatch = timeframe.match(/^(\d+)d$/);

  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
  } else {
    // fallback to 30 days
    start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }

  return {
    start,
    end: now,
  };
};
