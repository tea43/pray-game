# SDD-11: Multiplayer Architecture

## Purpose

Documents the multiplayer-ready design assumptions baked into every system, the stub RPC layer,
and the steps required to activate full co-op mode. Single-player runs on the same code path —
nothing needs to be removed or bypassed.

---

## Design Philosophy

P-RAY is authored for **2–4 player co-op** from the start. The architecture ensures:

1. Input is separated from entity logic (no `Input.*` inside `Hero.gd` or `Enemy.gd`).
2. Every entity that can be controlled or affected by a network peer has an `authority_id`.
3. Simulation is server-authoritative: `WaveSystem`, `LootSystem`, and `GameTime` run only on
   the server. Clients receive state updates, not raw deltas.
4. `EventBus` signals are local; a thin `NetworkRelay` forwards relevant events to peers.

---

## Authority Model

| System | Authority | Notes |
|--------|-----------|-------|
| `GameTime` | Server | Clients receive `game_delta` via RPC each frame |
| `WaveSystem` | Server | Clients receive `wave_started`, `enemy_spawned` RPCs |
| `LootSystem` | Server | Server rolls drops; clients receive `loot_spawned` RPC |
| `Hero` movement | Owning peer | Each hero belongs to one player; `authority_id` |
| `Hero` combat | Server | Damage application validated server-side |
| `Enemy` AI | Server | Clients receive position sync via `MultiplayerSynchronizer` |
| HUD | Local | Each client renders their own HUD |

---

## Single-Player Pass-Through

In single-player:
```gdscript
multiplayer.get_unique_id() == 1   # always true
# All authority_id == 1 checks pass
# "if not multiplayer.is_server()" → false, so server logic always runs
```

No configuration needed. The same binary runs single-player and co-op.

---

## Hero Authority

Each `Hero` node has `authority_id: int = 1`. The player who owns peer ID 2 controls `Hero[1]`,
peer ID 3 controls `Hero[2]`, etc. In single-player, the local player (peer 1) controls all.

```gdscript
# In HeroInputController.gd
func _dispatch_input_to_hero(hero: Hero, ...) -> void:
    if hero.authority_id != multiplayer.get_unique_id():
        return   # not this player's hero
    # ... dispatch move/attack/ability ...
```

Hero position ownership in Godot 4 multiplayer uses `set_multiplayer_authority()`:

```gdscript
# Called after spawning heroes and assigning peer IDs
func assign_hero_authority(hero: Hero, peer_id: int) -> void:
    hero.authority_id = peer_id
    hero.set_multiplayer_authority(peer_id)
    # Add MultiplayerSynchronizer for position sync
    var sync := MultiplayerSynchronizer.new()
    hero.add_child(sync)
    # Configure sync to replicate global_position, _hp, etc.
```

---

## NetworkRelay Stub

```gdscript
# res://scenes/systems/NetworkRelay.gd
class_name NetworkRelay extends Node

# ---- Server → Clients ----

## Broadcast GameTime delta to all peers each frame (server calls this).
@rpc("authority", "call_remote", "unreliable_ordered")
func sync_game_delta(game_delta: float) -> void:
    GameTime._receive_remote_delta(game_delta)

## Notify clients that a new enemy has spawned.
@rpc("authority", "call_remote", "reliable")
func notify_enemy_spawned(enemy_id: int, res_id: StringName, pos: Vector2) -> void:
    # Client instantiates enemy locally and sets its network ID
    pass

## Notify clients that loot has appeared.
@rpc("authority", "call_remote", "reliable")
func notify_loot_spawned(loot_id: StringName, pos: Vector2) -> void:
    pass

## Notify clients of a game phase transition.
@rpc("authority", "call_remote", "reliable")
func notify_phase_change(phase: int) -> void:
    GameState.phase = phase

# ---- Client → Server ----

## Client sends hero move command to server for validation.
@rpc("any_peer", "call_remote", "reliable")
func request_hero_move(hero_index: int, target: Vector2) -> void:
    if not multiplayer.is_server():
        return
    var hero: Hero = GameState.heroes[hero_index]
    if hero.authority_id != multiplayer.get_remote_sender_id():
        return   # reject: wrong peer
    hero.move_to(target)

## Client sends ability activation request.
@rpc("any_peer", "call_remote", "reliable")
func request_ability(hero_index: int) -> void:
    if not multiplayer.is_server():
        return
    var hero: Hero = GameState.heroes[hero_index]
    if hero.authority_id != multiplayer.get_remote_sender_id():
        return
    hero.activate_ability()
```

---

## GameTime in Multiplayer

In multiplayer, clients do not compute `GameTime.delta` independently. Instead:

```gdscript
# GameTime.gd additions for multiplayer

func _process(raw_delta: float) -> void:
    if multiplayer.is_server():
        var flowing := _compute_flowing()
        delta = raw_delta * SPEED_STEPS[speed_index] if flowing else 0.0
        if delta > 0.0:
            NetworkRelay.rpc("sync_game_delta", delta)
    # Clients: delta is set by _receive_remote_delta()

func _receive_remote_delta(game_delta: float) -> void:
    if multiplayer.is_server():
        return
    delta = game_delta
```

---

## MultiplayerSynchronizer Nodes

Add a `MultiplayerSynchronizer` child to each `Hero` and `Enemy` node.

### Hero sync properties (server replicates to all):
- `global_position` (unreliable, high frequency)
- `_hp` (reliable on change)
- `_dead` (reliable on change)

### Enemy sync properties (server replicates to all):
- `global_position` (unreliable)
- `_hp` (reliable on change)
- `_state` (reliable on change)
- `_stun_timer` (unreliable)

Configure `MultiplayerSynchronizer` in the inspector after adding:
- Replication interval: 0.05s (20 Hz) for positions.
- Visibility: `MultiplayerSynchronizer.VISIBILITY_PUBLIC` for all peers.

---

## Lobby & Connection (Stub)

```gdscript
# res://scenes/menu/LobbyManager.gd
class_name LobbyManager extends Node

const PORT := 7777
const MAX_PLAYERS := 4

func host_game() -> void:
    var peer := ENetMultiplayerPeer.new()
    peer.create_server(PORT, MAX_PLAYERS)
    multiplayer.multiplayer_peer = peer
    multiplayer.peer_connected.connect(_on_peer_connected)

func join_game(address: String) -> void:
    var peer := ENetMultiplayerPeer.new()
    peer.create_client(address, PORT)
    multiplayer.multiplayer_peer = peer

func _on_peer_connected(peer_id: int) -> void:
    # Assign a hero to the new peer
    # If all heroes are taken, reject or add to spectator
    pass
```

The full lobby UI and matchmaking are deferred — the stubs above ensure the RPC infrastructure
compiles and the single-player path is unchanged.

---

## Character Customization (Multiplayer Context)

In co-op, each player can select and customize their hero before the game starts. The
customization system (see below) is pre-lobby:

1. Player selects hero identity (Elliot / Dick / Habib / custom future hero).
2. Player selects starting weapon from an unlocked pool.
3. Player selects ability from an unlocked pool (if customization is enabled for the session).
4. Host starts the game; hero configs are serialized as `HeroResource` data and sent to all peers.

The `HeroResource` already supports this — it is a `Resource` that can be created at runtime
(not only from `.tres` files):

```gdscript
func build_custom_hero(base: HeroResource,
                        weapon: WeaponResource,
                        ability: AbilityResource) -> HeroResource:
    var custom := base.duplicate(true)   # deep copy
    custom.default_weapon = weapon
    custom.ability = ability
    return custom
```

---

## Activation Checklist (When Enabling Co-op)

These steps convert the stub-ready codebase into working co-op:

- [ ] Implement `LobbyManager` UI (host/join, player list).
- [ ] Wire `NetworkRelay.sync_game_delta` call in `GameTime._process` (server branch).
- [ ] Wire `notify_enemy_spawned` in `WaveSystem._spawn_enemy`.
- [ ] Wire `notify_loot_spawned` in `LootSystem._spawn_pickup`.
- [ ] Configure `MultiplayerSynchronizer` replication lists on `Hero` and `Enemy`.
- [ ] Assign `authority_id` to heroes based on peer join order.
- [ ] Test with two local clients using `--headless` on the server instance.

---

## LLM Prompt

```
You are implementing the multiplayer stubs for P-RAY, a Godot 4.4 GDScript game.

The game is single-player now but designed for 2-4 player co-op. The stubs must compile
and not break the single-player path.

Task:
1. Implement NetworkRelay.gd with all RPCs marked as shown in SDD-11.
2. Add multiplayer authority guards to HeroInputController (check authority_id).
3. Add _receive_remote_delta() to GameTime.gd.
4. Add set_multiplayer_authority() call in GameWorld after hero spawn.
5. Add MultiplayerSynchronizer node stubs to Hero.tscn and Enemy.tscn (no replication config yet).
6. Implement LobbyManager.gd stub (host_game, join_game, _on_peer_connected).
7. Implement build_custom_hero() utility function.

Rules:
- All server-only code is guarded by multiplayer.is_server().
- In single-player, multiplayer.get_unique_id() == 1 and is_server() == true.
- RPCs must not be called in _ready() — only after scene is fully loaded.
- NetworkRelay is a Node in the Systems container, not an autoload.

[paste SDD-00, SDD-11 here]
```
