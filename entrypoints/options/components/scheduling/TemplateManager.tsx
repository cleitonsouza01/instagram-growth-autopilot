import { useState } from "react";
import type { DMTemplate } from "../../../../storage/database";

interface TemplateManagerProps {
  templates: DMTemplate[];
  onSave: (template: {
    name: string;
    category: DMTemplate["category"];
    body: string;
  }) => void;
  onDelete: (id: number) => void;
}

const CATEGORIES: DMTemplate["category"][] = [
  "welcome",
  "collaboration",
  "faq",
  "custom",
];

export default function TemplateManager({
  templates,
  onSave,
  onDelete,
}: TemplateManagerProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DMTemplate["category"]>("custom");
  const [body, setBody] = useState("");

  const handleSave = () => {
    if (!name.trim() || !body.trim()) return;
    onSave({ name: name.trim(), category, body: body.trim() });
    setName("");
    setBody("");
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          DM Templates
        </h3>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-primary hover:text-primary-dark"
        >
          {editing ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {/* New template form */}
      {editing && (
        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as DMTemplate["category"])
            }
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hey {username}, thanks for following! {fullname}..."
            rows={3}
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm resize-y"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              Variables: {"{username}"}, {"{fullname}"}
            </span>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-dark"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !editing && (
        <p className="text-xs text-gray-400">No templates yet.</p>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className="p-3 bg-white border border-gray-200 rounded-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                {t.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {t.category}
                </span>
                {t.id && (
                  <button
                    onClick={() => onDelete(t.id!)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">
              {t.body}
            </p>
            <div className="mt-1 text-xs text-gray-400">
              Used {t.usageCount} time{t.usageCount !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
