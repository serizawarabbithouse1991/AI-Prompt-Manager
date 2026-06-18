import { IOSSheet } from "@/components/ios/IOSSheet";
import { GridSizeControl } from "@/components/file/GridSizeControl";

type IOSGridSizeSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function IOSGridSizeSheet({ open, onClose }: IOSGridSizeSheetProps) {
  return (
    <IOSSheet open={open} onClose={onClose} title="グリッドサイズ">
      <GridSizeControl variant="ios-compact" />
    </IOSSheet>
  );
}
