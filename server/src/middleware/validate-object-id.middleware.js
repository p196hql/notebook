import mongoose from "mongoose";

function validateObjectIdParam(paramName) {
  return function validateObjectId(req, res, next) {
    const value = req.params?.[paramName];

    if (!mongoose.isValidObjectId(value)) {
      return res.status(400).json({ message: `Invalid ${paramName}.` });
    }

    next();
  };
}

export { validateObjectIdParam };
