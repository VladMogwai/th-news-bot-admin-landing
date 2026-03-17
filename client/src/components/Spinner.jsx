export default function Spinner({ fullscreen }) {
  const ring = (
    <div className="h-10 w-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0d1117] z-50">
        {ring}
      </div>
    );
  }

  return <div className="flex justify-center py-8">{ring}</div>;
}
