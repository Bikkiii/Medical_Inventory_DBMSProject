// Small helper to throw a clean 400 error from any route.
// Usage: validate(req.body.name, "name is required")
function validate(value, message) {
  if (value === undefined || value === null || value === "") {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
}

module.exports = validate;
