using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Antares.Server.Infrastructure;

/// <summary>
/// 對 [NonUnify] action 的例外處理 wrapper.
///
/// 問題:
/// `[NonUnify]` 標的 action(e.g. /api/tables/alter)return success 時自己組
/// `{status, response}` envelope.但 **exception 路徑不會走 EnvelopeResultProvider.OnException**
/// 因為 NonUnify 直接 bypass unify provider — 結果 SQL 例外冒出 HTTP 500,
/// renderer 的 httpClient.ts:47 `if (!res.ok) throw` 短路,使用者看到 generic
/// 「API error 500」 而不是真正的錯誤訊息.
///
/// 修法:
/// 這個 filter 蓋在 NonUnify action 上,catch 例外後回 200 + envelope-error,
/// 跟 EnvelopeResultProvider.OnException 行為對齊(per CLAUDE.md wire contract:
/// HTTP 200 is canonical for BOTH success and error).
///
/// 使用:
///   [HttpPost("/api/tables/alter"), NonUnify, ExceptionAsEnvelope]
///   public async Task&lt;object&gt; Alter(...) { ... }
///
/// 為什麼不直接拿掉 [NonUnify]?
/// 拿掉後 EnvelopeResultProvider.OnSucceeded 會把 action 已經組好的
/// `{status:"success"}` 再包一層,變成 `{status:"success", response:{status:"success"}}`,
/// renderer 讀 outer 拿到 success 但 inner 才是真實狀態 — silently 吞掉錯誤.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class ExceptionAsEnvelopeAttribute : Attribute, IAsyncExceptionFilter
{
    public Task OnExceptionAsync(ExceptionContext context)
    {
        var message = context.Exception.Message;
        context.Result = new OkObjectResult(new { status = "error", response = message });
        context.ExceptionHandled = true;
        return Task.CompletedTask;
    }
}
