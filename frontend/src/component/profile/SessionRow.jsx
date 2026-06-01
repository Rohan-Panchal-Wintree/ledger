import Button from "../UI/Button";
import Badge from "../UI/Badge";

import {
  formatNetwork,
  formatProfileDateTime,
  getSessionIcon,
} from "../../utils/profileUtils";

export default function SessionRow({
  session,
  onTerminate,
  isTerminating = false,
}) {
  const Icon = getSessionIcon(session.deviceType);

  return (
    <tr className="table-row-hover">
      <td className="whitespace-nowrap px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
            <Icon className="text-primary" size={17} />
          </div>

          <span className="text-sm font-bold text-on-surface">
            {session.browser || "Unknown Browser"}
          </span>
        </div>
      </td>

      <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
        {session.device || "Unknown Device"}
      </td>

      <td className="whitespace-nowrap px-8 py-5 text-sm font-medium capitalize text-on-surface-variant">
        {session.deviceType || "desktop"}
      </td>

      <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
        {formatNetwork(session.ipAddress)}
      </td>

      <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
        {formatProfileDateTime(session.createdAt)}
      </td>

      <td className="whitespace-nowrap px-8 py-5 text-right">
        {session.current ? (
          <Badge variant="DP" textSize="10px">
            Current
          </Badge>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={isTerminating}
            disabled={isTerminating}
            onClick={() => onTerminate(session.sessionId)}
          >
            Logout
          </Button>
        )}
      </td>
    </tr>
  );
}
