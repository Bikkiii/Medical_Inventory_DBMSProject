export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "Confirm", confirmClass = "btn-danger" }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <h3>Confirm Action</h3>
        <div className="modal-body">
          <div className="confirm-dialog">
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p>{message}</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
