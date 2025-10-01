using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PosBackend.Domain.Entities;

namespace PosBackend.Application.Services;

public class ReceiptRenderer
{
    public byte[] RenderPdf(PosTransaction transaction, IEnumerable<TransactionLine> lines, decimal exchangeRate)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(20);
                page.Size(PageSizes.A6);
                page.Content().Stack(stack =>
                {
                    stack.Spacing(6);
                    stack.Item().Text("Aurora POS Receipt").FontSize(16).Bold();
                    stack.Item().Text($"Transaction #: {transaction.TransactionNumber}");
                    stack.Item().Text($"Date: {transaction.CreatedAt:yyyy-MM-dd HH:mm}");
                    stack.Item().Text($"Cashier: {transaction.UserId}");

                    stack.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Text("Item");
                            header.Cell().AlignRight().Text("Qty");
                            header.Cell().AlignRight().Text("Total");
                        });

                        foreach (var line in lines)
                        {
                            table.Cell().Text(line.Product?.Name ?? line.ProductId.ToString());
                            table.Cell().AlignRight().Text(line.Quantity.ToString("0.##"));
                            table.Cell().AlignRight().Text($"${line.TotalUsd:0.00}");
                        }
                    });

                    stack.Item().LineHorizontal(1);
                    stack.Item().Text($"Total USD: ${transaction.TotalUsd:0.00}");
                    stack.Item().Text($"Total LBP: {transaction.TotalLbp:0.00}");
                    stack.Item().Text($"Exchange Rate: {exchangeRate:0.00}");
                });
            });
        });

        return doc.GeneratePdf();
    }
}
