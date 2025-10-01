using System.Threading.Channels;

namespace PosBackend.Application.Services;

public record PosEvent(string EventType, object Payload);

public class PosEventHub
{
    private readonly Channel<PosEvent> _channel = Channel.CreateUnbounded<PosEvent>();

    public ChannelReader<PosEvent> Reader => _channel.Reader;

    public ValueTask PublishAsync(PosEvent evt) => _channel.Writer.WriteAsync(evt);
}
