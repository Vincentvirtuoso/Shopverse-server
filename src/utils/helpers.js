export const generateOrderNumber = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;

  const randomPart = String(Math.floor(Math.random() * 100000)).padStart(
    5,
    "0"
  );

  return `ORD-${datePart}-${randomPart}`;
};

export const getDateFromOrderNumber = (orderNumber) => {
  if (!validateOrderNumber(orderNumber)) {
    return null;
  }

  const datePart = orderNumber.split("-")[1];
  const year = parseInt(datePart.substring(0, 4), 10);
  const month = parseInt(datePart.substring(4, 6), 10) - 1;
  const day = parseInt(datePart.substring(6, 8), 10);

  return new Date(year, month, day);
};

export const generateUniqueOrderNumber = async (
  checkExists,
  maxAttempts = 10
) => {
  let attempts = 0;
  let orderNumber;
  let exists = true;

  while (exists && attempts < maxAttempts) {
    orderNumber = generateOrderNumber();
    exists = await checkExists(orderNumber);
    attempts++;

    if (exists && attempts >= maxAttempts) {
      // If we've tried maxAttempts times and still have collisions,
      // append a timestamp to guarantee uniqueness
      const timestamp = Date.now().toString().slice(-5);
      orderNumber = generateOrderNumber() + timestamp;
      exists = await checkExists(orderNumber);
    }
  }

  return orderNumber;
};

export const calculateShippingCost = (shippingAddress, orderItems) => {
  const baseShipping = 1500; // NGN

  // Adjust based on location
  let locationMultiplier = 1;
  if (shippingAddress.state?.toLowerCase().includes("lagos")) {
    locationMultiplier = 1.0;
  } else if (
    ["abuja", "port harcourt", "ibadan", "kano"].includes(
      shippingAddress.city?.toLowerCase()
    )
  ) {
    locationMultiplier = 1.2;
  } else {
    locationMultiplier = 1.5;
  }

  // Adjust based on total items weight/value
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const perItemCost = 200;

  const calculatedCost =
    (baseShipping + perItemCost * totalItems) * locationMultiplier;

  // Round to nearest 50
  return Math.round(calculatedCost / 50) * 50;
};

export const validateDiscountCode = async (code, subtotal, userId, session) => {
  // Implement your discount logic here
  // This is a simplified example
  const discounts = {
    WELCOME10: { type: "percentage", value: 10, minAmount: 0 },
    SAVE20: { type: "percentage", value: 20, minAmount: 10000 },
    FREESHIP: { type: "fixed", value: 1500, minAmount: 0 },
  };

  const discount = discounts[code.toUpperCase()];
  if (!discount) {
    return { valid: false, amount: 0, details: null };
  }

  if (subtotal < discount.minAmount) {
    return {
      valid: false,
      amount: 0,
      details: `Minimum order of ₦${discount.minAmount} required`,
    };
  }

  let amount = 0;
  if (discount.type === "percentage") {
    amount = (subtotal * discount.value) / 100;
  } else if (discount.type === "fixed") {
    amount = discount.value;
  }

  return {
    valid: true,
    amount,
    details: `${discount.value}${
      discount.type === "percentage" ? "%" : "₦"
    } off`,
  };
};
