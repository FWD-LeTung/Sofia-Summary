// popup.js
console.log("Sofia extension loaded!");
function countCharacters(text) {
    return text.trim().length;
}

function calculateCompression(original, summary) {
    if (!original || original.length === 0) return 0;
    const reduction = 100 - (summary.length * 100 / original.length);
    return Math.round(reduction * 10) / 10; // Làm tròn 1 số thập phân
}

function showProgress() {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('result').innerHTML = '';
    updateProgress(0);
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
}

function updateProgress(percent) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');

    const safePercent = Math.min(100, Math.max(0, percent));
    
    progressFill.style.width = `${safePercent}%`;
    progressPercent.textContent = `${Math.round(safePercent)}%`;
    
    if (safePercent < 90) {
        const nextPercent = safePercent + (100 - safePercent) * 0.1;
        setTimeout(() => updateProgress(nextPercent), 500);
    }
}
async function callDeepSeekAPI(text) {
    console.log("Gọi Cloudflare Worker...");
    try {
    const response = await fetch(CONFIG.PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        text: text 
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Worker error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error from worker');
    }
    
    return data.summary;
    
  } catch (error) {
    console.error("Lỗi khi gọi worker:", error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM đã tải xong!");
    const pasteBtn = document.getElementById('pasteBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');
    
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async function() {
            console.log("Paste button clicked!");
            
            try {
                // Đọc text từ clipboard
                const text = await navigator.clipboard.readText();
                console.log("Text from clipboard:", text.substring(0, 50) + "...");
                
                // Hiển thị vào textarea
                document.getElementById('textInput').value = text;
                const textInput = document.getElementById('textInput');
                const charCount = document.getElementById('charCount');

                if (textInput && charCount) {
                    textInput.addEventListener('input', function() {
                        const count = countCharacters(this.value);
                        charCount.textContent = count.toLocaleString();
                        
                        // Đổi màu nếu quá dài
                        if (count > 5000) {
                            charCount.style.color = '#dc2626';
                        } else if (count > 2000) {
                            charCount.style.color = '#d97706';
                        } else {
                            charCount.style.color = '#6b7280';
                        }
                    });
                    
                    // Update initial count
                    charCount.textContent = countCharacters(textInput.value).toLocaleString();
                }                
                
            } catch (error) {
                console.error("Lỗi khi đọc clipboard:", error);
                document.getElementById('textInput').value = "Không thể đọc clipboard. Hãy copy text trước.";
            }
        });
    }
    
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async function() {
            console.log("Summarize button clicked!");
            const text = document.getElementById('textInput').value;
            const resultDiv = document.getElementById('result');
        
            
            if (text.trim() === "") {
                resultDiv.innerHTML = "<p class='error-message'>Vui lòng nhập văn bản</p>";
                return;
            }
            
            showProgress();
            updateProgress(10); 
            
            let progressInterval;
            
            try {
                progressInterval = setInterval(() => {
                    const currentPercent = parseInt(document.getElementById('progressPercent').textContent);
                    if (currentPercent < 70) {
                        updateProgress(currentPercent + 5);
                    }
                }, 300);
                
                // Gọi API
                const summary = await callDeepSeekAPI(text);
                const originalLength = countCharacters(text);
                const summaryLength = countCharacters(summary);
    
                // Dừng interval
                clearInterval(progressInterval);
                
                // Hoàn thành progress
                updateProgress(100);
                
                // Delay nhỏ để người dùng thấy 100%
                setTimeout(() => {
                    hideProgress();
                    // Xử lý text trước khi hiển thị
                    const formattedSummary = summary
                        .trim() 
                        .replace(/^\s*\n+/g, '') 
                        .replace(/•/g, '\n•') 
                        .replace(/^\n/, ''); 

                    resultDiv.innerHTML = `
                        <div style="margin-top: 5px; line-height: 1.4; white-space: pre-line;">
                            ${summary}
                        </div>
                        
                        <div id="resultStats" style="font-size: 12px; color: #6b7280; margin-top: 10px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                            • Input: <span id="inputStats">${originalLength.toLocaleString()} ký tự</span><br>
                            • Output: <span id="outputStats">${summaryLength.toLocaleString()} ký tự</span><br>
                        </div>
                        
                        <button id="copySummaryBtn" style="margin-top: 15px; padding: 8px 15px;">
                            📋 Sao chép tóm tắt
                        </button>
                    `;                    

                    document.getElementById('copySummaryBtn').addEventListener('click', async function() {
                        try {
                            await navigator.clipboard.writeText(summary);
                            alert("Đã sao chép tóm tắt!");
                        } catch (err) {
                            console.error("Lỗi khi sao chép:", err);
                        }
                    });
                    
                }, 500);
                
            } catch (error) {
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                hideProgress();
                resultDiv.innerHTML = `
                    <div class="error-message">
                        <strong> Lỗi:</strong> ${error.message}
                        <p><small>Kiểm tra API Key và kết nối mạng</small></p>
                    </div>
                `;
                console.error("Lỗi API:", error);
            }
        });
    }
});