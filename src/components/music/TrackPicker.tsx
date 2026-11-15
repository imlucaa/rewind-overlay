'use client';

import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CATEGORY_LABELS, type Track, type TrackCategory } from '@/lib/music/tracks';

interface Props {
  tracks: readonly Track[];
  /** Tracks that already play this song, ticked in the list. */
  using: ReadonlySet<string>;
  label: string;
  onPick: (track: Track) => void;
  /** Picking a track that already has the song takes it off. */
  onRemove: (track: Track) => void;
}

/** "Add to track": a searchable list of every track, grouped by category. A tick marks the tracks that have the song. */
export function TrackPicker({ tracks, using, label, onPick, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const groups = Object.groupBy(tracks, t => t.category);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label}>
          Add to track
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search tracks" />
          <CommandList>
            <CommandEmpty>No tracks match.</CommandEmpty>
            {(Object.keys(CATEGORY_LABELS) as TrackCategory[]).map(category =>
              groups[category]?.length ? (
                <CommandGroup key={category} heading={CATEGORY_LABELS[category]}>
                  {groups[category].map(t => (
                    <CommandItem
                      key={t.file}
                      value={`${t.name} ${t.variantOf} ${t.file}`}
                      onSelect={() => {
                        if (using.has(t.file)) onRemove(t);
                        else onPick(t);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        {t.name}
                        {t.variantOf ? <span className="text-muted-foreground"> · version of {t.variantOf}</span> : null}
                      </span>
                      {using.has(t.file) ? <CheckIcon aria-label="Has this song; pick to remove it" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
