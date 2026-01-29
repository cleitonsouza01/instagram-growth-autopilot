import type { ScheduledPost } from "../../../../storage/database";

interface CalendarViewProps {
  posts: ScheduledPost[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onPostClick: (post: ScheduledPost) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({
  posts,
  currentMonth,
  onMonthChange,
  onPostClick,
}: CalendarViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const postsByDay = new Map<number, ScheduledPost[]>();
  for (const post of posts) {
    const d = new Date(post.scheduledAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const existing = postsByDay.get(day) ?? [];
      existing.push(post);
      postsByDay.set(day, existing);
    }
  }

  const prevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="px-2 py-1 text-gray-500 hover:text-gray-700"
        >
          &larr;
        </button>
        <h3 className="text-sm font-semibold text-gray-700">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="px-2 py-1 text-gray-500 hover:text-gray-700"
        >
          &rarr;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-xs text-gray-400 text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const dayPosts = day ? postsByDay.get(day) ?? [] : [];
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();

          return (
            <div
              key={i}
              className={`min-h-12 p-1 rounded text-xs ${
                day ? "bg-gray-50" : ""
              } ${isToday ? "ring-1 ring-primary" : ""}`}
            >
              {day && (
                <>
                  <div className="text-gray-500 mb-0.5">{day}</div>
                  {dayPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => onPostClick(post)}
                      className={`block w-full text-left px-1 py-0.5 rounded text-[10px] truncate mb-0.5 ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700"
                          : post.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {new Date(post.scheduledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
