# Training report

同梱した学習済みブックの生成条件を、artifact 本体から機械的に再構成したメモです。ニューラルネットの学習ではなく、自己対戦の結果を state-action 統計として保持する方式を採っています。

- bundle games: 6
- total episodes: 4485
- total retained states: 8637
- total decision samples: 61297

## tic-tac-toe
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 600 episodes
- seeds: 101, 211, 307
- episodes: 1800
- retained states: 259
- decision samples: 14931
- recommendation threshold: visits >= 8, confidence >= 0.18
- generated: 2026-04-05T11:03:37.588Z
- most-sampled state: P1| / visits 1800
## connect-four
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 25 episodes
- seeds: 113, 223, 331
- episodes: 75
- retained states: 1537
- decision samples: 1954
- recommendation threshold: visits >= 4, confidence >= 0.08
- generated: 2026-04-05T11:04:56.599Z
- most-sampled state: P1| / visits 75
## lane-breakthrough
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 400 episodes
- seeds: 127, 239, 347
- episodes: 1200
- retained states: 1281
- decision samples: 19003
- recommendation threshold: visits >= 6, confidence >= 0.12
- generated: 2026-04-05T11:06:37.901Z
- most-sampled state: P1|P1:soldier@0,0;P1:soldier@1,0;P1:soldier@1,1;P1:soldier@2,0;P1:soldier@3,0;P1:soldier@3,1;P1:… / visits 1200
## knight-skirmish
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 120 episodes
- seeds: 131, 241, 353
- episodes: 360
- retained states: 1260
- decision samples: 11043
- recommendation threshold: visits >= 4, confidence >= 0.1
- generated: 2026-04-05T11:10:28.976Z
- most-sampled state: P1|P1:rider@3,4;P2:rider@4,3 / visits 361
## royal-duel
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 250 episodes
- seeds: 149, 257, 359
- episodes: 750
- retained states: 2258
- decision samples: 9295
- recommendation threshold: visits >= 4, confidence >= 0.1
- generated: 2026-04-05T11:12:53.581Z
- most-sampled state: P1|P1:bishop@4,0;P1:king@2,0;P1:rook@0,0;P2:bishop@4,4;P2:king@2,4;P2:rook@0,4 / visits 750
## relay-outpost
- teacher: minimax
- training mode: multi-seed-self-play / 3 shards x 100 episodes
- seeds: 157, 263, 367
- episodes: 300
- retained states: 2042
- decision samples: 5071
- recommendation threshold: visits >= 3, confidence >= 0.08
- generated: 2026-04-05T11:14:29.899Z
- most-sampled state: P1|P1:runner@2,0;P2:runner@2,4 / visits 300
