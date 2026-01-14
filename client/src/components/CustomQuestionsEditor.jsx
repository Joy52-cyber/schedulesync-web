import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export default function CustomQuestionsEditor({ questions = [], onChange }) {
  const addQuestion = () => {
    onChange([
      ...questions,
      {
        id: `q_${Date.now()}`,
        label: '',
        type: 'text',
        required: false,
        placeholder: ''
      }
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Custom Questions</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add questions guests must answer when booking</p>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No custom questions yet</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move flex-shrink-0" />

              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => updateQuestion(index, 'label', e.target.value)}
                    placeholder="Question label"
                    className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="select">Dropdown</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <input
                    type="text"
                    value={q.placeholder || ''}
                    onChange={(e) => updateQuestion(index, 'placeholder', e.target.value)}
                    placeholder="Placeholder text (optional)"
                    className="flex-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                    />
                    Required
                  </label>
                </div>

                {q.type === 'select' && (
                  <input
                    type="text"
                    value={q.options?.join(', ') || ''}
                    onChange={(e) => updateQuestion(index, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Options (comma separated): Option 1, Option 2, Option 3"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => removeQuestion(index)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
