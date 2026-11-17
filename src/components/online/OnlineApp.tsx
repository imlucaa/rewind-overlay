'use client';

import { DoorOpenIcon, TrophyIcon, UserRoundSearchIcon } from 'lucide-react';
import { AppShell, Reveal, Tab } from '@/components/layout/AppShell';
import { useOnlineRoute, useRemote, type OnlineTab } from '@/hooks/useRwfc';
import { formatVr, getRoomStats } from '@/lib/rwfc/api';
import { LeaderboardView } from './LeaderboardView';
import { PlayersView } from './PlayersView';
import { RoomsView } from './RoomsView';

const TABS: { id: OnlineTab; label: string; icon: typeof DoorOpenIcon }[] = [
  { id: 'rooms', label: 'Rooms', icon: DoorOpenIcon },
  { id: 'leaderboard', label: 'Leaderboard', icon: TrophyIcon },
  { id: 'players', label: 'Players', icon: UserRoundSearchIcon },
];

/** Retro Rewind online: live rooms, the VR leaderboard and player profiles, all from rwfc.net. */
export function OnlineApp() {
  const [route, go] = useOnlineRoute();
  const stats = useRemote('room-stats', getRoomStats, 60000);
  const openPlayer = (fc: string | null) => go({ tab: 'players', fc, vs: null });

  return (
    <AppShell
      tabsLabel="Rooms"
      tabs={TABS.map(t => (
        <Tab key={t.id} current={route.tab === t.id} onSelect={() => go({ tab: t.id })}>
          <t.icon aria-hidden="true" className="size-4" />
          {t.label}
        </Tab>
      ))}
      status={
        stats.data ? (
          <span>
            <b className="text-foreground font-medium tabular-nums">{formatVr(stats.data.totalPlayers)}</b> racing in{' '}
            <b className="text-foreground font-medium tabular-nums">{stats.data.totalRooms}</b> room{stats.data.totalRooms === 1 ? '' : 's'}{' '}
            right now
          </span>
        ) : undefined
      }
    >
      <Reveal id={route.tab}>
        {route.tab === 'rooms' ? (
          <RoomsView selected={route.room} onSelect={room => go({ room }, true)} onPlayer={openPlayer} />
        ) : route.tab === 'leaderboard' ? (
          <LeaderboardView current={route.fc} onPlayer={openPlayer} />
        ) : (
          <PlayersView
            fc={route.fc}
            vs={route.vs}
            onPlayer={openPlayer}
            onRoom={room => go({ tab: 'rooms', room })}
            onCompare={vs => go({ vs })}
          />
        )}
      </Reveal>
    </AppShell>
  );
}
