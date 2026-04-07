export default function Dashboard({
  isAdmin,
  user,
  filtered,
  baseData,
  filters,
  setFilters,
  uploadMeta,
  navigate,
}) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            {isAdmin
              ? "Settlement Overview"
              : `Welcome, ${user?.email?.split("@")[0]}`}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "View and manage all merchant settlements"
              : "Your settlement records"}
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => navigate("/upload")}
            className="gap-2 w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            Upload Payment Sheet
          </Button>
        )}
      </div>
    </div>
  );
}
