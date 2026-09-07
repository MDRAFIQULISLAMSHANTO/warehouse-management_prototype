/**
 * Demonstration actions.
 *
 * State is the seed plus an ordered log of these actions. Persisting the log
 * rather than the whole dataset keeps localStorage small, makes "Reset Demo"
 * exact, and means a refresh replays to precisely the same state.
 */

export interface ValidateLineInput {
  lineId: string;
  doneQty: number;
  destLocationId?: string;
  destPalletId?: string | null;
}

export type RemainderChoice = "backorder" | "cancel";

export type DemoAction =
  | {
      type: "check_availability";
      operationId: string;
      at: string;
    }
  | {
      type: "validate";
      operationId: string;
      lines: ValidateLineInput[];
      remainder: RemainderChoice;
      at: string;
    }
  | {
      type: "cancel";
      operationId: string;
      at: string;
    }
  | {
      type: "set_draft";
      operationId: string;
      at: string;
    }
  | {
      /** Relocate a whole pallet to an empty, compatible cell. */
      type: "create_relocation";
      operationId: string;
      palletId: string;
      destLocationId: string;
      operatorId: string;
      at: string;
      note?: string;
    }
  | {
      /** Pick a quantity from one pallet to the warehouse output area. */
      type: "create_pick";
      operationId: string;
      palletId: string;
      quantity: number;
      operatorId: string;
      partnerId?: string;
      manualLotSelection?: boolean;
      at: string;
    }
  | {
      /** Put a received pallet away into a suggested cell. */
      type: "create_putaway";
      operationId: string;
      palletId: string;
      destLocationId: string;
      operatorId: string;
      at: string;
    };

export interface ActionResult {
  ok: boolean;
  /** User-facing message; shown as an Odoo-style notification. */
  message?: string;
  /** Set when the action created a record worth navigating to. */
  createdOperationId?: string;
}
