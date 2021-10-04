const listeningMarker =
  '_reactListening' +
  Math.random()
    .toString(36)
    .slice(2);

    
export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
    if ((rootContainerElement as any)[listeningMarker]) {
        // Performance optimization: don't iterate through events
        // for the same portal container or root node more than once.
        // TODO: once we remove the flag, we may be able to also
        // remove some of the bookkeeping maps used for laziness.
        return;
      }
      (rootContainerElement as any)[listeningMarker] = true;
      allNativeEvents.forEach(domEventName => {
        if (!nonDelegatedEvents.has(domEventName)) {
          listenToNativeEvent(
            domEventName,
            false,
            ((rootContainerElement: any): Element),
            null,
          );
        }
        listenToNativeEvent(
          domEventName,
          true,
          ((rootContainerElement: any): Element),
          null,
        );
      });
  }