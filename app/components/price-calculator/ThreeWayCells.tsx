import { X } from "lucide-react";

interface AttachmentCellProps {
  itemId: string;
  attachments: Record<string, string>;
  onRemoveAttachment: (itemId: string) => void;
  onFileUpload: (itemId: string, file: File) => Promise<void>;
}

interface ThreeWayCellsProps extends AttachmentCellProps {
  itemId: string;
  defaultCost: number;
  defaultMarkup: number;
  priceOverrides: Record<string, number>;
  markupOverrides: Record<string, number>;
  onCostChange: (itemId: string, value: string) => void;
  onMarkupChange: (itemId: string, value: string, currentCost: number) => void;
  onTotalChange: (
    itemId: string,
    totalValue: string,
    defaultMarkup: number,
  ) => void;
  finished: boolean;
  showAttachment?: boolean;
}

const AttachmentCell = ({
  itemId,
  attachments,
  onRemoveAttachment,
  onFileUpload,
}: AttachmentCellProps) => {
  const url = attachments[itemId];
  const getFileName = (url: string) =>
    url.split("/").pop()?.replace(/^\d+-/, "") ?? "";

  return (
    <td className="px-2 py-1.5">
      {url ? (
        <div className="flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-20 truncate text-xs font-medium text-brand hover:underline"
          >
            {getFileName(url)}
          </a>
          <button
            onClick={() => onRemoveAttachment(itemId)}
            className="inline-flex size-5 items-center justify-center rounded text-muted hover:bg-red-50 hover:text-red-600"
            aria-label="Fjern vedlegg"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <input
          type="file"
          className="w-28 text-xs text-muted file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink hover:file:bg-gray-200"
          onChange={(e) =>
            e.target.files && onFileUpload(itemId, e.target.files[0])
          }
        />
      )}
    </td>
  );
};

export const ThreeWayCells = ({
  itemId,
  defaultCost,
  defaultMarkup,
  priceOverrides,
  markupOverrides,
  onCostChange,
  onMarkupChange,
  onTotalChange,
  finished,
  showAttachment,
  attachments,
  onRemoveAttachment,
  onFileUpload,
}: ThreeWayCellsProps) => {
  const cost = priceOverrides[itemId] ?? defaultCost;
  const markup = markupOverrides[itemId] ?? defaultMarkup;
  const rowTotal = cost * (1 + markup / 100);

  return (
    <>
      <td className="px-2 py-1.5 text-right">
        <input
          value={cost}
          onChange={(e) => onCostChange(itemId, e.target.value)}
          className="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
        />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <input
          type="number"
          value={markup.toFixed(1)}
          onChange={(e) => onMarkupChange(itemId, e.target.value, cost)}
          className="w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
        />
        <span className="ml-0.5 text-xs text-muted">%</span>
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <input
          value={rowTotal.toFixed(0)}
          onChange={(e) => onTotalChange(itemId, e.target.value, markup)}
          className="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white font-semibold"
        />
        <span className="ml-0.5 text-xs text-muted">kr</span>
      </td>
      {finished && showAttachment && (
        <AttachmentCell
          itemId={itemId}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
          onFileUpload={onFileUpload}
        />
      )}
    </>
  );
};
