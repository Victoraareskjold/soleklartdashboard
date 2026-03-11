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
    <td className="p-2">
      {url ? (
        <div className="flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-xs truncate max-w-20"
          >
            {getFileName(url)}
          </a>
          <button
            onClick={() => onRemoveAttachment(itemId)}
            className="text-red-400 hover:text-red-600 font-bold text-sm"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          type="file"
          className="text-xs w-28"
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
      <td className="p-2 text-right">
        <input
          value={cost}
          onChange={(e) => onCostChange(itemId, e.target.value)}
          className="text-right w-24 bg-gray-100 p-1 border border-gray-200"
        />
      </td>
      <td className="p-2 text-right">
        <input
          type="number"
          value={markup.toFixed(1)}
          onChange={(e) => onMarkupChange(itemId, e.target.value, cost)}
          className="text-right w-16 bg-gray-100 p-1 border border-gray-200"
        />{" "}
        %
      </td>
      <td className="p-2 text-right">
        <input
          value={rowTotal.toFixed(0)}
          onChange={(e) => onTotalChange(itemId, e.target.value, markup)}
          className="text-right w-24 bg-gray-100 p-1 border border-gray-200"
        />{" "}
        kr
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
