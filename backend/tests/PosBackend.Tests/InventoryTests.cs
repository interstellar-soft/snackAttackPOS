using PosBackend.Domain.Entities;
using Xunit;

namespace PosBackend.Tests;

public class InventoryTests
{
    [Fact]
    public void Inventory_Defaults_EnableReorderAlarmAtThreeUnits()
    {
        var inventory = new Inventory();

        Assert.Equal(3m, inventory.ReorderPoint);
        Assert.True(inventory.IsReorderAlarmEnabled);
    }
}
