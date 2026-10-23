import { IS_STATIC } from "@/lib/staticApi";

export default function About() {
  return (
    <div className="fade-up pt-8">
      <h1 className="font-serif text-3xl font-bold">設計說明</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-foreground/75">
        「岔路」是一個小型的人生選擇體驗。它想練習的不是「教你做對的選擇」，
        而是讓你經歷：選擇會真實地改變事情、資訊永遠不完整、
        每個人的行為背後都有自己的難處。
      </p>

      {/* 四層設計 */}
      <section className="mt-12">
        <h2 className="mb-6 font-serif text-lg font-semibold">四層設計</h2>

        <div className="space-y-10">
          <div>
            <h3 className="font-medium">一、選擇與分支</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              以《打烊前十分鐘》為例：12 個節點、3 條主要路線、12 個結局。
              「留下處理」會讓你接觸到店長與店裡的資訊；「追出去」會讓你
              接觸到同事的處境，但店裡的事由別人收尾；「交接後離開」會讓你
              看見資訊在人與人之間漏接的過程。三條路接觸不同的人、能做不同的事，
              事件結果也不同——不是只換一段旁白。
            </p>
          </div>

          <div>
            <h3 className="font-medium">二、隱藏資訊</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              每個情境有一套固定的真相，8 條線索分配在不同路線上。
              同一晚的「小雯突然離開」，在店內路線看起來像失職，
              在追出去的路線看起來是家裡出事，在交接路線則是一場沒有人惡意
              卻真實發生的誤會。線索筆記把「事實」與「某人的說法」分開標示——
              說法不等於全貌。每個結局都會告訴你還有幾條線索不在這輪的視野裡，
              邀請你回頭走別的路。
            </p>
          </div>

          <div>
            <h3 className="font-medium">三、不評判玩家</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              沒有分數、沒有善良值、沒有「好結局／壞結局」。離開不會被扣分，
              留下也不會被加分——它們只是導向不同的後果。
              理解角色的難處不會被用來替傷害開脫，設定界線也不等於冷漠。
              結局文字只描述「發生了什麼、誰受到什麼影響、還有什麼沒有被知道」。
            </p>
          </div>

          <div>
            <h3 className="font-medium">四、AI 的參與</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {IS_STATIC ? (
                <>
                  完整版的設計裡，AI 負責結局後的反思回饋，以及你主動要求時的
                  新情境撰寫（例如《停電那晚》就是 AI 預先生成、通過驗證後
                  收錄的情境）。它不會在遊玩中改寫劇情、不會評斷你的人格、
                  不會決定結局。此靜態版本沒有 AI 通道，反思回饋由系統內建
                  規則即時產生，如實標示。
                </>
              ) : (
                <>
                  AI 在這個體驗裡負責兩件事：結局後的反思回饋，以及你主動要求時的
                  新情境撰寫。它不會在遊玩中改寫劇情、不會評斷你的人格、
                  不會決定結局。所有 AI 生成的內容都會標示來源；
                  當 AI 無法連線時，系統內建的規則式回饋會接手，並如實標示。
                </>
              )}
            </p>
            {IS_STATIC && (
              <p className="mt-3 max-w-xl rounded-lg border border-border/60 bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                你目前看到的是純前端靜態部署版（GitHub Pages）：反思回饋由
                系統內建規則即時產生，AI 生成新情境的功能需要後端，在此版本
                不提供。帶後端的完整版另有部署。
              </p>
            )}
          </div>
        </div>
      </section>

      {/* AI 使用範圍與成本 */}
      <section className="mt-12 border-t border-border/60 pt-10">
        <h2 className="mb-6 font-serif text-lg font-semibold">
          AI 使用範圍、成本與成果
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">功能</th>
                <th className="pb-3 pr-4 font-medium">使用範圍</th>
                <th className="pb-3 font-medium">成本控制</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/40">
                <td className="py-3.5 pr-4 text-foreground">反思回饋</td>
                <td className="py-3.5 pr-4 leading-relaxed">
                  僅在結局頁產生一次。輸入只包含你這一輪的選擇、已發現的線索與結局內容——
                  AI 看不到你沒發現的線索，因此無法劇透。輸出形式是「描述＋提問」，
                  被明確禁止評判。
                </td>
                <td className="py-3.5 leading-relaxed">
                  每局最多 1 次呼叫，上限 700 tokens；相同路徑的紀錄直接使用快取，
                  不重複呼叫。
                </td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="py-3.5 pr-4 text-foreground">情境生成</td>
                <td className="py-3.5 pr-4 leading-relaxed">
                  只在你主動輸入主題並按下「開始撰寫」時呼叫。產出必須通過
                  結構驗證（節點與結局參照完整、可從起點抵達），失敗僅重試一次。
                </td>
                <td className="py-3.5 leading-relaxed">
                  上限 8000 tokens／次；全站每小時最多 10 次（含重試）；
                  額度狀態在首頁即時顯示。
                </td>
              </tr>
              <tr>
                <td className="py-3.5 pr-4 text-foreground">成果展示</td>
                <td className="py-3.5 pr-4 leading-relaxed" colSpan={2}>
                  {IS_STATIC ? (
                    <>
                      每一輪紀錄（路徑、線索、結局、回饋來源）保存在你的瀏覽器，
                      累積成「探索地圖」：哪些結局被走到過、哪些線索被發現過。
                      AI 生成的情境（如《停電那晚》）以固定資料收錄，成為可重玩的內容。
                    </>
                  ) : (
                    <>
                      每一輪紀錄（路徑、線索、結局、回饋來源）保存在伺服器，
                      累積成「探索地圖」：哪些結局被走到過、哪些線索被發現過。
                      AI 情境通過驗證後進入「情境圖書館」，成為可重玩的內容。
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          誠實標示原則：規則式回饋不冒充即時 AI；AI 生成的情境會標示「AI 生成」；
          兩種回饋來源（AI／系統內建）在結局頁都清楚標明。
        </p>
      </section>

      {/* 為什麼這樣設計 */}
      <section className="mt-12 border-t border-border/60 pt-10">
        <h2 className="mb-6 font-serif text-lg font-semibold">
          為什麼把 AI 放在結局，而不是遊玩中
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          遊玩中的即時生成會讓故事失去「固定的真相」——同一個選擇每次結果不同，
          玩家就無法比較不同的路。所以真相是寫死的，AI 只在你走完一輪之後，
          依你的紀錄陪你回看。這樣 AI 成為反思的鏡子，而不是命運的骰子。
        </p>
      </section>
    </div>
  );
}
