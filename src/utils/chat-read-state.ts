import { RoomReadInfo } from 'src/types/chat';

export function roomReadSummary(info: RoomReadInfo, uid: string) {
  const unreadRecipients = Object.entries(info.memberIds ?? {}).filter(
    ([memberId, active]) =>
      memberId !== uid && active === true && (info.readState?.[memberId]?.unreadCount ?? 0) > 0,
  ).length;
  return {
    unreadCount: info.readState?.[uid]?.unreadCount ?? 0,
    unreadRecipients,
    unreadRevision: info.unreadRevision ?? 0,
  };
}
