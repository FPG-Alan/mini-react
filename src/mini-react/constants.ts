export const LegacyRoot = 0;
export const BlockingRoot = 1;
export const ConcurrentRoot = 2;

export const NoMode = 0b00000;
// TODO: Remove BlockingMode and ConcurrentMode by reading from the root
// tag instead
export const BlockingMode = 0b00010;
export const ConcurrentMode = 0b00100;

// 这里面的 host 应该是指宿主上的对应类型
// 比如 HostText, 如果宿主是react-dom, HostText应该是HTMLTextNode
export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2; // Before we know whether it is function or class
export const HostRoot = 3; // Root of a host tree. Could be nested inside another node.
export const HostPortal = 4; // A subtree. Could be an entry point to a different renderer.
export const HostComponent = 5;
export const HostText = 6;
export const Fragment = 7;
export const Mode = 8;
export const ContextConsumer = 9;
export const ContextProvider = 10;
export const ForwardRef = 11;
export const Profiler = 12;
export const SuspenseComponent = 13;
export const MemoComponent = 14;
export const SimpleMemoComponent = 15;
export const LazyComponent = 16;
export const IncompleteClassComponent = 17;
export const DehydratedFragment = 18;
export const SuspenseListComponent = 19;
export const FundamentalComponent = 20;
export const ScopeComponent = 21;
export const Block = 22;
export const OffscreenComponent = 23;
export const LegacyHiddenComponent = 24;

// Don't change these two values. They're used by React Dev Tools.
export const NoFlags = /*                      */ 0b000000000000000000;
export const PerformedWork = /*                */ 0b000000000000000001;

// You can change the rest (and add more).
export const Placement = /*                    */ 0b000000000000000010;
export const Update = /*                       */ 0b000000000000000100;
export const PlacementAndUpdate = /*           */ 0b000000000000000110;
export const Deletion = /*                     */ 0b000000000000001000;
export const ContentReset = /*                 */ 0b000000000000010000;
export const Callback = /*                     */ 0b000000000000100000;
export const DidCapture = /*                   */ 0b000000000001000000;
export const Ref = /*                          */ 0b000000000010000000;
export const Snapshot = /*                     */ 0b000000000100000000;
export const Passive = /*                      */ 0b000000001000000000;
// TODO (effects) Remove this bit once the new reconciler is synced to the old.
export const PassiveUnmountPendingDev = /*     */ 0b000010000000000000;
export const Hydrating = /*                    */ 0b000000010000000000;
export const HydratingAndUpdate = /*           */ 0b000000010000000100;

// Passive & Update & Callback & Ref & Snapshot
export const LifecycleEffectMask = /*          */ 0b000000001110100100;

// Union of all host effects
export const HostEffectMask = /*               */ 0b000000011111111111;

// These are not really side effects, but we still reuse this field.
export const Incomplete = /*                   */ 0b000000100000000000;
export const ShouldCapture = /*                */ 0b000001000000000000;
export const ForceUpdateForLegacySuspense = /* */ 0b000100000000000000;

// Static tags describe aspects of a fiber that are not specific to a render,
// e.g. a fiber uses a passive effect (even if there are no updates on this particular render).
// This enables us to defer more work in the unmount case,
// since we can defer traversing the tree during layout to look for Passive effects,
// and instead rely on the static flag as a signal that there may be cleanup work.
export const PassiveStatic = /*                */ 0b001000000000000000;

// Union of side effect groupings as pertains to subtreeFlags
export const BeforeMutationMask = /*           */ 0b000000001100001010;
export const MutationMask = /*                 */ 0b000000010010011110;
export const LayoutMask = /*                   */ 0b000000000010100100;
export const PassiveMask = /*                  */ 0b000000001000001000;

// Union of tags that don't get reset on clones.
// This allows certain concepts to persist without recalculting them,
// e.g. whether a subtree contains passive effects or portals.
export const StaticMask = /*                   */ 0b001000000000000000;

// These flags allow us to traverse to fibers that have effects on mount
// without traversing the entire tree after every commit for
// double invoking
export const MountLayoutDev = /*               */ 0b010000000000000000;
export const MountPassiveDev = /*              */ 0b100000000000000000;

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

export const REACT_ELEMENT_TYPE = Symbol.for("react.element");
