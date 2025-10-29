console.log('🔮 Ritual Debug Script Loaded');

// Function to force show the ritual dialog for testing
function forceShowRitual() {
    console.log('🔧 Force showing ritual dialog...');
    
    // Clear any existing mission profile
    localStorage.removeItem('te.mission.profile');
    console.log('✓ Cleared mission profile');
    
    // Find the dialog
    const dialog = document.querySelector('[data-landing-ritual]');
    if (!dialog) {
        console.error('❌ Ritual dialog not found');
        return;
    }
    
    // Reset dialog state
    dialog.removeAttribute('hidden');
    dialog.removeAttribute('data-ritual-state');
    dialog.setAttribute('aria-hidden', 'false');
    
    // Show mission stage
    const stages = dialog.querySelectorAll('[data-ritual-step]');
    stages.forEach(stage => {
        const stepName = stage.getAttribute('data-ritual-step');
        if (stepName === 'mission') {
            stage.removeAttribute('hidden');
            stage.classList.add('landing-ritual__stage--active');
            console.log('✓ Mission stage made visible');
        } else {
            stage.setAttribute('hidden', '');
            stage.classList.remove('landing-ritual__stage--active');
        }
    });
    
    // Open the dialog
    try {
        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
        dialog.classList.add('landing-ritual--open');
        console.log('✓ Dialog opened');
    } catch (error) {
        console.error('❌ Failed to open dialog:', error);
        dialog.setAttribute('open', '');
        dialog.classList.add('landing-ritual--open');
    }
    
    // Check if buttons are visible
    const missionButtons = dialog.querySelectorAll('[data-mission-option]');
    console.log(`🔍 Found ${missionButtons.length} mission buttons`);
    
    missionButtons.forEach((button, i) => {
        const isVisible = button.offsetParent !== null;
        const option = button.dataset.missionOption;
        console.log(`  Button ${i + 1} (${option}): visible=${isVisible}`);
        
        if (!isVisible) {
            // Force button to be visible
            button.style.display = 'block';
            button.style.visibility = 'visible';
        }
    });
}

// Function to check ritual status
function checkRitualStatus() {
    console.log('🔍 Checking ritual status...');
    
    const missionData = localStorage.getItem('te.mission.profile');
    if (missionData) {
        const profile = JSON.parse(missionData);
        console.log('📋 Mission profile exists:', profile);
        console.log('   This explains why ritual dialog is hidden!');
        console.log('   Use clearMissionProfile() to reset');
    } else {
        console.log('📋 No mission profile found');
    }
    
    const dialog = document.querySelector('[data-landing-ritual]');
    if (dialog) {
        console.log('🔮 Dialog state:');
        console.log('  - open:', dialog.hasAttribute('open'));
        console.log('  - hidden:', dialog.hasAttribute('hidden'));
        console.log('  - ritual-state:', dialog.dataset.ritualState);
        console.log('  - aria-hidden:', dialog.getAttribute('aria-hidden'));
        console.log('  - display:', window.getComputedStyle(dialog).display);
    }
}

// Function to clear mission profile
function clearMissionProfile() {
    localStorage.removeItem('te.mission.profile');
    console.log('✓ Mission profile cleared. Refresh page to see ritual.');
}

// Add to global scope for easy access in console
window.forceShowRitual = forceShowRitual;
window.checkRitualStatus = checkRitualStatus;
window.clearMissionProfile = clearMissionProfile;

// Auto-check status when loaded
setTimeout(() => {
    checkRitualStatus();
    console.log('💡 Available functions:');
    console.log('  - checkRitualStatus() - Check current state');
    console.log('  - clearMissionProfile() - Clear saved mission');
    console.log('  - forceShowRitual() - Force show dialog');
}, 1000);