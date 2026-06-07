interface DeleteConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ message, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🗑️</div>
          <p className="text-gray-800 font-medium whitespace-pre-wrap">{message}</p>
        </div>
        <div className="grid gap-2">
          <button
            onClick={onConfirm}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:bg-red-600"
          >
            削除する
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold active:bg-gray-200"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
