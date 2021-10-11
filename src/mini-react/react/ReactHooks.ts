type BasicStateAction<S> = (state: S) => S | S;
type Dispatch<A> = (state: A) => void;

/**
 * Keeps track of the current dispatcher.
 */
export const ReactCurrentDispatcher: any = {
  /**
   * @internal
   * @type {ReactComponent}
   */
  current: null,
};

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  if (!(dispatcher !== null)) {
    throw new Error(
      "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for" +
        " one of the following reasons:\n" +
        "1. You might have mismatching versions of React and the renderer (such as React DOM)\n" +
        "2. You might be breaking the Rules of Hooks\n" +
        "3. You might have more than one copy of React in the same app\n" +
        "See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem."
    );
  }

  return dispatcher;
}

export function useState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<any> | null
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}
