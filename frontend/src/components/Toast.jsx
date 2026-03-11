function Toast({ message, type }) {
  if (!message) return null;
  return (
    <div className={`toast toast-${type}`}>
      {type === "success" ? "✓" : "✗"} {message}
    </div>
  );
}
export default Toast;
