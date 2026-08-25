const COMPANION_GATE_HOLD_MS = 2_000;

type CompanionGateElements = {
  keyboardTarget: Window;
  leftTouchCorner: HTMLElement;
  rightTouchCorner: HTMLElement;
  isOpen?: () => boolean;
  onOpen: () => void;
};

export function installCompanionGate(elements: CompanionGateElements): () => void {
  const heldKeys = new Set<string>();
  const heldTouchPointers = {
    left: new Set<number>(),
    right: new Set<number>(),
  };
  let keyboardTimer: number | undefined;
  let touchTimer: number | undefined;
  let keyboardGateOpened = false;
  let touchGateOpened = false;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key !== "Shift" && event.key !== "Enter") {
      return;
    }

    heldKeys.add(event.key);

    if (heldKeys.has("Shift") && heldKeys.has("Enter")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startKeyboardTimer();
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.key);

    if (!heldKeys.has("Shift") || !heldKeys.has("Enter")) {
      clearKeyboardTimer();
      keyboardGateOpened = false;
    }
  };

  const handleWindowBlur = (): void => {
    heldKeys.clear();
    clearKeyboardTimer();
    keyboardGateOpened = false;
    heldTouchPointers.left.clear();
    heldTouchPointers.right.clear();
    clearTouchTimer();
    touchGateOpened = false;
  };

  const handleLeftTouchStart = (event: PointerEvent): void => {
    handleTouchStart(event, "left");
  };

  const handleRightTouchStart = (event: PointerEvent): void => {
    handleTouchStart(event, "right");
  };

  const handleLeftTouchEnd = (event: PointerEvent): void => {
    handleTouchEnd(event, "left");
  };

  const handleRightTouchEnd = (event: PointerEvent): void => {
    handleTouchEnd(event, "right");
  };

  const handleGlobalTouchEnd = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }

    heldTouchPointers.left.delete(event.pointerId);
    heldTouchPointers.right.delete(event.pointerId);

    if (!hasBothTouchCorners()) {
      clearTouchTimer();
      touchGateOpened = false;
    }
  };

  elements.keyboardTarget.addEventListener("keydown", handleKeyDown, true);
  elements.keyboardTarget.addEventListener("keyup", handleKeyUp, true);
  elements.keyboardTarget.addEventListener("blur", handleWindowBlur);
  elements.keyboardTarget.addEventListener("pointerup", handleGlobalTouchEnd, true);
  elements.keyboardTarget.addEventListener("pointercancel", handleGlobalTouchEnd, true);
  elements.leftTouchCorner.addEventListener("pointerdown", handleLeftTouchStart);
  elements.rightTouchCorner.addEventListener("pointerdown", handleRightTouchStart);
  elements.leftTouchCorner.addEventListener("pointerup", handleLeftTouchEnd);
  elements.leftTouchCorner.addEventListener("pointercancel", handleLeftTouchEnd);
  elements.leftTouchCorner.addEventListener("pointerleave", handleLeftTouchEnd);
  elements.rightTouchCorner.addEventListener("pointerup", handleRightTouchEnd);
  elements.rightTouchCorner.addEventListener("pointercancel", handleRightTouchEnd);
  elements.rightTouchCorner.addEventListener("pointerleave", handleRightTouchEnd);

  return () => {
    clearKeyboardTimer();
    clearTouchTimer();
    elements.keyboardTarget.removeEventListener("keydown", handleKeyDown, true);
    elements.keyboardTarget.removeEventListener("keyup", handleKeyUp, true);
    elements.keyboardTarget.removeEventListener("blur", handleWindowBlur);
    elements.keyboardTarget.removeEventListener("pointerup", handleGlobalTouchEnd, true);
    elements.keyboardTarget.removeEventListener("pointercancel", handleGlobalTouchEnd, true);
    elements.leftTouchCorner.removeEventListener("pointerdown", handleLeftTouchStart);
    elements.rightTouchCorner.removeEventListener("pointerdown", handleRightTouchStart);
    elements.leftTouchCorner.removeEventListener("pointerup", handleLeftTouchEnd);
    elements.leftTouchCorner.removeEventListener("pointercancel", handleLeftTouchEnd);
    elements.leftTouchCorner.removeEventListener("pointerleave", handleLeftTouchEnd);
    elements.rightTouchCorner.removeEventListener("pointerup", handleRightTouchEnd);
    elements.rightTouchCorner.removeEventListener("pointercancel", handleRightTouchEnd);
    elements.rightTouchCorner.removeEventListener("pointerleave", handleRightTouchEnd);
  };

  function startKeyboardTimer(): void {
    if (elements.isOpen?.() || keyboardGateOpened || keyboardTimer !== undefined) {
      return;
    }

    keyboardTimer = elements.keyboardTarget.setTimeout(() => {
      keyboardTimer = undefined;
      keyboardGateOpened = true;
      elements.onOpen();
    }, COMPANION_GATE_HOLD_MS);
  }

  function clearKeyboardTimer(): void {
    if (keyboardTimer === undefined) {
      return;
    }

    elements.keyboardTarget.clearTimeout(keyboardTimer);
    keyboardTimer = undefined;
  }

  function handleTouchStart(event: PointerEvent, corner: "left" | "right"): void {
    if (event.pointerType !== "touch") {
      return;
    }

    event.preventDefault();
    heldTouchPointers[corner].add(event.pointerId);
    startTouchTimer();
  }

  function handleTouchEnd(event: PointerEvent, corner: "left" | "right"): void {
    heldTouchPointers[corner].delete(event.pointerId);

    if (!hasBothTouchCorners()) {
      clearTouchTimer();
      touchGateOpened = false;
    }
  }

  function startTouchTimer(): void {
    if (elements.isOpen?.() || touchGateOpened || touchTimer !== undefined || !hasBothTouchCorners()) {
      return;
    }

    touchTimer = elements.keyboardTarget.setTimeout(() => {
      touchTimer = undefined;
      touchGateOpened = true;
      elements.onOpen();
    }, COMPANION_GATE_HOLD_MS);
  }

  function clearTouchTimer(): void {
    if (touchTimer === undefined) {
      return;
    }

    elements.keyboardTarget.clearTimeout(touchTimer);
    touchTimer = undefined;
  }

  function hasBothTouchCorners(): boolean {
    return heldTouchPointers.left.size > 0 && heldTouchPointers.right.size > 0;
  }
}
