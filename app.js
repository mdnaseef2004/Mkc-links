// ==========================================
// MARKAZ KNOWLEDGE CITY - APPLICATION LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const splashModal = document.getElementById('splashModal');
    const enterBtn = document.getElementById('enterBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const sharePageBtn = document.getElementById('sharePageBtn');
    const qrBtn = document.getElementById('qrBtn');
    const qrModal = document.getElementById('qrModal');
    const closeQrBtn = document.getElementById('closeQrBtn');
    const downloadQrBtn = document.getElementById('downloadQrBtn');
    const qrcodeDiv = document.getElementById('qrcode');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const copyBtns = document.querySelectorAll('.copy-btn');

    // 1. Entrance Splash Pop-up Logic
    const closeSplash = () => {
        splashModal.classList.add('hidden');
        sessionStorage.setItem('mkc_splash_seen', 'true');
    };

    if (enterBtn) {
        enterBtn.addEventListener('click', closeSplash);
    }

    // Also close splash if user clicks outside content on backdrop
    splashModal.addEventListener('click', (e) => {
        if (e.target === splashModal || e.target.classList.contains('splash-backdrop')) {
            closeSplash();
        }
    });

    // Auto-dismiss splash after 3 seconds if not interacted with
    setTimeout(() => {
        if (!splashModal.classList.contains('hidden')) {
            closeSplash();
        }
    }, 3200);

    // 2. Copy Link to Clipboard Toast Notification
    const showToast = (message) => {
        toastMsg.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    };

    copyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const urlToCopy = btn.getAttribute('data-url');
            if (urlToCopy) {
                navigator.clipboard.writeText(urlToCopy).then(() => {
                    showToast('Link copied to clipboard!');
                }).catch(err => {
                    // Fallback
                    const tempInput = document.createElement('input');
                    tempInput.value = urlToCopy;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                    showToast('Link copied to clipboard!');
                });
            }
        });
    });

    // 3. Share Page Feature
    if (sharePageBtn) {
        sharePageBtn.addEventListener('click', () => {
            const shareData = {
                title: 'Markaz Knowledge City - Official Links',
                text: 'Connect with Markaz Knowledge City on WhatsApp, Facebook, YouTube, Instagram & Website.',
                url: window.location.href
            };

            if (navigator.share) {
                navigator.share(shareData).catch(err => console.log('Share canceled'));
            } else {
                navigator.clipboard.writeText(window.location.href);
                showToast('Page link copied to clipboard!');
            }
        });
    }

    // 4. QR Code Generator Modal
    let qrGenerated = false;

    if (qrBtn) {
        qrBtn.addEventListener('click', () => {
            qrModal.classList.add('active');
            if (!qrGenerated && window.QRCode) {
                qrcodeDiv.innerHTML = '';
                new QRCode(qrcodeDiv, {
                    text: window.location.href.includes('http') ? window.location.href : 'https://www.markazknowledgecity.com/',
                    width: 180,
                    height: 180,
                    colorDark: '#0B111E',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                qrGenerated = true;
            }
        });
    }

    if (closeQrBtn) {
        closeQrBtn.addEventListener('click', () => {
            qrModal.classList.remove('active');
        });
    }

    qrModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            qrModal.classList.remove('active');
        }
    });

    // Download QR Code
    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', () => {
            const qrImg = qrcodeDiv.querySelector('img') || qrcodeDiv.querySelector('canvas');
            if (qrImg) {
                let imgUri;
                if (qrImg.tagName === 'IMG') {
                    imgUri = qrImg.src;
                } else if (qrImg.tagName === 'CANVAS') {
                    imgUri = qrImg.toDataURL('image/png');
                }

                const link = document.createElement('a');
                link.download = 'markaz-knowledge-city-qr.png';
                link.href = imgUri;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('QR Code downloaded!');
            }
        });
    }

    // 5. Automatic System Theme Detection & Sync
    const applyTheme = (theme, isUserOverride = false) => {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
        if (icon) {
            icon.className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (isUserOverride) {
            localStorage.setItem('mkc_theme', theme);
        }
    };

    const getSystemTheme = () => {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    };

    // Initial detection on load
    const savedTheme = localStorage.getItem('mkc_theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(getSystemTheme());
    }

    // Listen for live system theme preference changes (e.g. system dark/light schedule)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('mkc_theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

    // Manual Theme Toggle Button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || getSystemTheme();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme, true);
            showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
        });
    }
});
