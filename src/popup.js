// popup.js
console.log("Sofia extension loaded!");

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
    
    // Giới hạn percent từ 0-100
    const safePercent = Math.min(100, Math.max(0, percent));
    
    progressFill.style.width = `${safePercent}%`;
    progressPercent.textContent = `${Math.round(safePercent)}%`;
    
    // Tự động tăng progress nếu chưa đạt 90%
    if (safePercent < 90) {
        // Mô phỏng progress tăng dần
        const nextPercent = safePercent + (100 - safePercent) * 0.1;
        setTimeout(() => updateProgress(nextPercent), 500);
    }
}
// HÀM GỌI DEEPSEEK API - THÊM Ở ĐÂY
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

// Đợi HTML tải xong rồi mới thêm event listeners
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
            
            // Hiển thị progress bar
            showProgress();
            updateProgress(10); // Bắt đầu từ 10%
            
            // Khai báo progressInterval ở scope phù hợp
            let progressInterval;
            
            try {
                // Giả lập progress trong khi chờ API
                progressInterval = setInterval(() => {
                    const currentPercent = parseInt(document.getElementById('progressPercent').textContent);
                    if (currentPercent < 70) {
                        updateProgress(currentPercent + 5);
                    }
                }, 300);
                
                // Gọi API
                const summary = await callDeepSeekAPI(text);
                
                // Dừng interval
                clearInterval(progressInterval);
                
                // Hoàn thành progress
                updateProgress(100);
                
                // Delay nhỏ để người dùng thấy 100%
                setTimeout(() => {
                    hideProgress();
                    // Xử lý text trước khi hiển thị
                    const formattedSummary = summary
                        .trim() // Loại bỏ khoảng trắng đầu/cuối
                        .replace(/^\s*\n+/g, '') // Loại bỏ dòng trống đầu tiên
                        .replace(/•/g, '\n•') // Thêm dòng trước mỗi bullet
                        .replace(/^\n/, ''); // Loại bỏ dòng trống đầu tiên nếu có

                    resultDiv.innerHTML = `
                        <div style="margin-top: 0; line-height: 1.4; white-space: pre-line;">
                            ${formattedSummary}
                        </div>
                        <button id="copySummaryBtn" style="margin-top: 10px; padding: 8px 15px;">
                            📋 Sao chép tóm tắt
                        </button>
                    `;                    

                    document.getElementById('copySummaryBtn').addEventListener('click', async function() {
                        try {
                            await navigator.clipboard.writeText(summary);
                            alert("✅ Đã sao chép tóm tắt!");
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
                        <strong>❌ Lỗi:</strong> ${error.message}
                        <p><small>Kiểm tra API Key và kết nối mạng</small></p>
                    </div>
                `;
                console.error("Lỗi API:", error);
            }
        });
    }
});