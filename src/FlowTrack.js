import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Chart } from "chart.js/auto";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode.react@3.1.0/+esm";
import "./FlowTrack.css";
import Logo from "./logo.svg";
import { supabase } from './lib/supabaseClient';
import { useAuth, useEntitlements } from './hooks/useEntitlements';
import Paywall from './components/Paywall';
import UpgradeButton from './components/UpgradeButton';
import AuthButtons from './components/AuthButtons';

// Enhanced Modal Component with better styling
const Modal = ({ show, message, onConfirm, onCancel, videoUrl, title }) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className={videoUrl ? "modal-content video-modal" : "modal-content"}>
        {videoUrl ? (
          <div>
            <h3 className="modal-title">{title || "Drill Video"}</h3>
            <iframe
              src={videoUrl}
              title="Drill Video"
              frameBorder="0"
              allowFullScreen
              className="video-iframe"
            ></iframe>
            <div className="modal-actions">
              <button className="button" onClick={onCancel}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="modal-title">{title || "Confirm Action"}</h3>
            <p>{message}</p>
            <div className="modal-actions">
              <button className="button danger" onClick={onConfirm}>
                Confirm
              </button>
              <button className="button" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Enhanced Toast Notification Component
const Toast = ({ show, message, type, onClose }) => {
  if (!show) return null;

  return (
    <div className={`toast-notification toast-${type}`}>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
};

// Practice Timer Component
const PracticeTimer = ({ isActive, onStart, onPause, onReset, elapsedTime, totalTime }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? (elapsedTime / totalTime) * 100 : 0;

  return (
    <div className="practice-timer">
      <div className="timer-display">
        <div className="timer-time">{formatTime(elapsedTime)}</div>
        <div className="timer-progress">
          <div className="timer-progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="timer-total">Total: {formatTime(totalTime)}</div>
      </div>
      <div className="timer-controls">
        {!isActive ? (
          <button className="button primary" onClick={onStart}>
            ▶ Start Practice
          </button>
        ) : (
          <button className="button" onClick={onPause}>
            ⏸ Pause
          </button>
        )}
        <button className="button small" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
};

// Enhanced Drill Card Component
const DrillCard = ({ drill, onAdd, onView, showAddButton = true, showVideo = true, compact = false, addOnCardClick = false }) => {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Beginner': return '#48bb78';
      case 'Intermediate': return '#ed8936';
      case 'Advanced': return '#e53e3e';
      default: return '#718096';
    }
  };

  const getSkillIcon = (skill) => {
    const icons = {
      'Shooting': '🎯',
      'Defense': '🛡️',
      'Passing': '🤝',
      'Dribbling': '🏀',
      'Conditioning': '💪',
      'Strategy': '🧠',
      'Other': '⚡'
    };
    return icons[skill] || '⚡';
  };

  return (
    <div
      className={`drill-card ${compact ? 'compact' : ''}`}
      onClick={() => { if (addOnCardClick && onAdd) onAdd(drill); }}
      role={addOnCardClick ? 'button' : undefined}
      tabIndex={addOnCardClick ? 0 : undefined}
    >
      <div className="drill-header">
        <div className="drill-skill-icon">{getSkillIcon(drill.skill)}</div>
        <div className="drill-info">
          <h4 className="drill-title">{drill.title}</h4>
          <span
            className="drill-difficulty"
            style={{ backgroundColor: getDifficultyColor(drill.difficulty) }}
          >
            {drill.difficulty}
          </span>
          <div className="drill-meta">
            <span className="drill-duration">{drill.duration} min</span>
            <span className="drill-skill">{drill.skill}</span>
          </div>
        </div>
      </div>
      
      {drill.notes && !compact && (
        <p className="drill-notes">{drill.notes}</p>
      )}
      
      <div className="drill-actions">
        {showVideo && drill.videoUrl && (
          <button
            className="button small video-btn"
            onClick={(e) => { e.stopPropagation(); onView(drill.videoUrl); }}
            title="View drill video"
          >
            ▶ Video
          </button>
        )}
        {showAddButton && (
          <button
            className="button small primary"
            onClick={() => onAdd(drill)}
            title="Add to session"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
};

// Enhanced Dashboard Card Component
const DashboardCard = ({ title, children, icon, className = "" }) => {
  return (
    <div className={`dashboard-card ${className}`}>
      <div className="card-header">
        {icon && <span className="card-icon">{icon}</span>}
        <h3>{title}</h3>
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

// Filter Chips Component
const FilterChips = ({
  label,
  options,
  active,
  onChange,
  allowAll = true
}) => {
  return (
    <div className="chips">
      {allowAll && (
        <button
          className={`chip ${active === 'All' ? 'active' : ''}`}
          onClick={() => onChange('All')}
        >
          {label}: All
        </button>
      )}
      {options.map(opt => (
        <button
          key={opt}
          className={`chip ${active === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
      {active !== 'All' && (
        <button className="chip clear" onClick={() => onChange('All')}>Clear</button>
      )}
    </div>
  );
};

export default function FlowTrack() {
  // Auth and entitlements
  const { user, loading: authLoading } = useAuth();
  const { plan: planFromDb, entitlements: entitlementsFromDb, loading: entitlementsLoading } = useEntitlements();
  const [showPaywall, setShowPaywall] = useState(false);

  // Use real entitlements when available, fallback to pro for dev
  const plan = entitlementsLoading ? 'loading' : (planFromDb || 'pro');
  const entitlements = entitlementsLoading ? {} : (entitlementsFromDb || { teams: 5, players: 200, templates: true, analytics: true, ai: false });

  // Always allow pro features for now
  const requirePro = useCallback((_featureCheck) => true, []);
  const skillCategories = ["Shooting", "Defense", "Passing", "Dribbling", "Conditioning", "Strategy", "Other"];
  const difficultyLevels = ["Beginner", "Intermediate", "Advanced"];
  const practiceCategories = ["Warm-up", "Skills", "Team Tactics", "Cool Down", "Game Simulation"];
  const drillPresets = [
    { title: "3-Point Shooting", duration: 10, skill: "Shooting", difficulty: "Intermediate", notes: "Focus on form and range.", videoUrl: "", assignedPlayers: [], preset: "3-Point Shooting" },
    { title: "Full-Court Press", duration: 12, skill: "Defense", difficulty: "Advanced", notes: "High intensity, quick transitions.", videoUrl: "", assignedPlayers: [], preset: "Full-Court Press" },
    { title: "Dribble Drills", duration: 8, skill: "Dribbling", difficulty: "Beginner", notes: "Work on both hands.", videoUrl: "", assignedPlayers: [], preset: "Dribble Drills" }
  ];

  // State to manage which section is active
  const [activeSection, setActiveSection] = useState("dashboard");
  // App mode: simple or pro (persisted)
  const [mode, setMode] = useState(() => localStorage.getItem('flowtrackMode') || 'simple');
  // Onboarding banner (persisted)
  const [onboardingSeen, setOnboardingSeen] = useState(() => localStorage.getItem('flowtrackOnboardingSeen') === 'true');

  // Practice Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);

  // Player Management - with Local Storage persistence
  const [players, setPlayers] = useState(() => {
    const savedPlayers = localStorage.getItem('flowtrackPlayers');
    return savedPlayers ? JSON.parse(savedPlayers) : [];
  });
  const [newPlayer, setNewPlayer] = useState({ name: "", jersey: "", performanceHistory: [] });
  const [playerSortBy, setPlayerSortBy] = useState("name");
  const [newPerformance, setNewPerformance] = useState({
    playerId: "",
    date: "",
    drillId: "",
    metrics: { shotsMade: 0, shotsAttempted: 0 }
  });

  // Drill Library - with Local Storage persistence
  const [drillLibrary, setDrillLibrary] = useState(() => {
    const savedDrills = localStorage.getItem('flowtrackDrills');
    return savedDrills ? JSON.parse(savedDrills) : [
      { id: 1, title: "Spot Shooting", duration: 10, skill: "Shooting", difficulty: "Beginner", notes: "Focus on form and follow-through.", assignedPlayers: [], videoUrl: "" },
      { id: 2, title: "Closeout Defense", duration: 8, skill: "Defense", difficulty: "Intermediate", notes: "Stay low and quick, contest without fouling.", assignedPlayers: [], videoUrl: "" },
      { id: 3, title: "Pick & Roll Passing", duration: 12, skill: "Passing", difficulty: "Intermediate", notes: "Timing is key, hit the roller or the pop man.", assignedPlayers: [], videoUrl: "" },
      { id: 4, title: "Ball Handling Circuit", duration: 15, skill: "Dribbling", difficulty: "Beginner", notes: "Keep eyes up, work on both hands.", assignedPlayers: [], videoUrl: "" },
      { id: 5, title: "Transition Defense", duration: 10, skill: "Defense", difficulty: "Advanced", notes: "Sprint back quickly, identify threats.", assignedPlayers: [], videoUrl: "" },
      { id: 6, title: "Free Throw Routine", duration: 7, skill: "Shooting", difficulty: "Beginner", notes: "Simulate game pressure, consistent routine.", assignedPlayers: [], videoUrl: "" },
      { id: 7, title: "Fast Break Drills", duration: 10, skill: "Strategy", difficulty: "Intermediate", notes: "Numbers advantage, outlet passes.", assignedPlayers: [], videoUrl: "" },
      { id: 8, title: "Full Court Press Break", duration: 10, skill: "Strategy", difficulty: "Advanced", notes: "Stay composed, use sideline and middle.", assignedPlayers: [], videoUrl: "" },
    ];
  });
  const [newDrill, setNewDrill] = useState({ title: "", duration: "", skill: skillCategories[0], difficulty: difficultyLevels[0], notes: "", assignedPlayers: [], videoUrl: "", preset: "" });
  const [editingDrillId, setEditingDrillId] = useState(null);
  // manageDrillSearchTerm is declared later; keep one source of truth
  const [highlightDrillForm, setHighlightDrillForm] = useState(false);

  // Practice Sessions - with Local Storage persistence
  const [sessions, setSessions] = useState(() => {
    const savedSessions = localStorage.getItem('flowtrackSessions');
    return savedSessions ? JSON.parse(savedSessions) : [];
  });
  const [form, setForm] = useState({
    date: "",
    category: practiceCategories[0],
    name: "",
    drills: [],
    notes: "",
    performanceMetrics: {}
  });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [quickSessionMode, setQuickSessionMode] = useState(false);

  // On-Court Mode state
  const [onCourtSessionId, setOnCourtSessionId] = useState(null);
  const [onCourtIndex, setOnCourtIndex] = useState(0);
  const [onCourtRunning, setOnCourtRunning] = useState(false);
  const [onCourtRemaining, setOnCourtRemaining] = useState(0); // seconds
  const [onCourtInterval, setOnCourtInterval] = useState(null);

  // Stations/Rotations state
  const [numStations, setNumStations] = useState(3);
  const [rotationMinutes, setRotationMinutes] = useState(8);
  const [stationConfigs, setStationConfigs] = useState([]); // [{id,name,drillId}]
  const [generatedGroups, setGeneratedGroups] = useState([]); // [[playerIds]]
  const [generatedSchedule, setGeneratedSchedule] = useState([]); // rounds -> stations -> group index

  // On-Court derived drills
  const onCourtDrills = useMemo(() => {
    if (onCourtSessionId) {
      const s = sessions.find(x => x.id === onCourtSessionId);
      return s?.drills || [];
    }
    return form.drills;
  }, [onCourtSessionId, sessions, form.drills]);

  // On-Court countdown effect
  useEffect(() => {
    if (!onCourtRunning) return;
    if (onCourtRemaining <= 0) {
      const nextIndex = onCourtIndex + 1;
      if (nextIndex < onCourtDrills.length) {
        setOnCourtIndex(nextIndex);
        setOnCourtRemaining((Number(onCourtDrills[nextIndex]?.duration) || 0) * 60);
      } else {
        setOnCourtRunning(false);
        setOnCourtRemaining(0);
        if (onCourtDrills.length > 0) {
          showToastMessage('Session complete!', 'success');
        }
      }
      return;
    }
    const id = setInterval(() => setOnCourtRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [onCourtRunning, onCourtRemaining, onCourtIndex, onCourtDrills]);

  // Session Templates - with Local Storage persistence
  const [sessionTemplates, setSessionTemplates] = useState(() => {
    const savedTemplates = localStorage.getItem('flowtrackSessionTemplates');
    return savedTemplates ? JSON.parse(savedTemplates) : [];
  });

  // Drill Filtering
  const [drillSearchTerm, setDrillSearchTerm] = useState("");
  const [drillFilterSkill, setDrillFilterSkill] = useState("All");
  const [drillFilterDifficulty, setDrillFilterDifficulty] = useState("All");
  
  // Enhanced Search and Filtering
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounced search values and loading states
  const [debouncedDrillSearch, setDebouncedDrillSearch] = useState("");
  const [debouncedManageSearch, setDebouncedManageSearch] = useState("");
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState("");
  const [isFilteringDrills, setIsFilteringDrills] = useState(false);
  const [isFilteringManage, setIsFilteringManage] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState(null);
  const [modalVideoUrl, setModalVideoUrl] = useState("");

  // Toast Notification State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  // Player Analytics State
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [showSuggestedDrills, setShowSuggestedDrills] = useState(false);
  const [suggestedDrills, setSuggestedDrills] = useState([]);

  // Timer Functions
  const startTimer = () => {
    setTimerActive(true);
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const pauseTimer = () => {
    setTimerActive(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const resetTimer = () => {
    setTimerActive(false);
    setElapsedTime(0);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  // Function to show toast messages
  const showToastMessage = useCallback((message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    const timer = setTimeout(() => {
      setShowToast(false);
      setToastMessage("");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Persist mode and onboarding flags
  useEffect(() => {
    localStorage.setItem('flowtrackMode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('flowtrackOnboardingSeen', String(onboardingSeen));
  }, [onboardingSeen]);

  // Function to handle confirmations with modal
  const confirmAction = useCallback((message, action) => {
    setModalMessage(message);
    setModalAction(() => action);
    setShowModal(true);
    setModalVideoUrl("");
  }, []);

  const handleModalConfirm = useCallback(() => {
    if (modalAction) {
      modalAction();
    }
    setShowModal(false);
    setModalAction(null);
    setModalMessage("");
    setModalVideoUrl("");
  }, [modalAction]);

  const handleModalCancel = useCallback(() => {
    setShowModal(false);
    setModalAction(null);
    setModalMessage("");
    setModalVideoUrl("");
  }, []);

  // Show video in modal
  const showVideo = (videoUrl) => {
    if (videoUrl) {
      setModalVideoUrl(videoUrl);
      setShowModal(true);
    } else {
      showToastMessage("No video available for this drill.", "error");
    }
  };

  // Effects for Local Storage persistence
  useEffect(() => {
    localStorage.setItem('flowtrackPlayers', JSON.stringify(players));
  }, [players]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  useEffect(() => {
    localStorage.setItem('flowtrackDrills', JSON.stringify(drillLibrary));
  }, [drillLibrary]);

  useEffect(() => {
    localStorage.setItem('flowtrackSessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('flowtrackSessionTemplates', JSON.stringify(sessionTemplates));
  }, [sessionTemplates]);

  // Effect to trigger drill form highlight animation
  useEffect(() => {
    if (highlightDrillForm) {
      const timer = setTimeout(() => {
        setHighlightDrillForm(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightDrillForm]);

  // Chart.js Effect for Player Analytics
  useEffect(() => {
    if (activeSection === "playerAnalytics" && selectedPlayerId) {
      const player = players.find(p => p.id === selectedPlayerId);
      if (!player || !player.performanceHistory || player.performanceHistory.length === 0) return;

      const shootingData = player.performanceHistory
        .filter(record => record.metrics && record.metrics.shotsAttempted > 0)
        .map(record => ({
          date: record.date,
          percentage: (record.metrics.shotsMade / record.metrics.shotsAttempted * 100).toFixed(1)
        }));

      const ctx = document.getElementById('shootingChart')?.getContext('2d');
      if (!ctx) return;

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: shootingData.map(d => d.date),
          datasets: [{
            label: 'Shooting Percentage',
            data: shootingData.map(d => d.percentage),
            borderColor: 'var(--primary-color)',
            backgroundColor: 'rgba(44, 82, 130, 0.2)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true },
            title: { display: true, text: `${player.name}'s Shooting Progress` },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${context.parsed.y}% on ${context.label}`;
                }
              }
            }
          },
          scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } },
            x: { title: { display: true, text: 'Date' } }
          }
        }
      });

      return () => chart.destroy();
    }
  }, [activeSection, selectedPlayerId, players]);

  // Debounce: drill search
  useEffect(() => {
    setIsFilteringDrills(true);
    const t = setTimeout(() => {
      setDebouncedDrillSearch(drillSearchTerm.trim());
      setIsFilteringDrills(false);
    }, 250);
    return () => clearTimeout(t);
  }, [drillSearchTerm]);

  // Debounce: manage drills search
  const [manageDrillSearchTerm, setManageDrillSearchTerm] = useState("");
  useEffect(() => {
    setIsFilteringManage(true);
    const t = setTimeout(() => {
      setDebouncedManageSearch(manageDrillSearchTerm.trim());
      setIsFilteringManage(false);
    }, 250);
    return () => clearTimeout(t);
  }, [manageDrillSearchTerm]);

  // Debounce: global search (reserved for future global filtering)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalSearch(globalSearchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [globalSearchTerm]);

  // Default to Quick Session in Simple mode when opening Practice Planner
  useEffect(() => {
    if (activeSection === 'practicePlanner' && mode === 'simple') {
      setQuickSessionMode(true);
    }
  }, [activeSection, mode]);

  // Form handlers for session
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Performance Metrics Handler
  const handlePerformanceChange = (uniqueId, playerId, field, value) => {
    setForm(prev => ({
      ...prev,
      performanceMetrics: {
        ...prev.performanceMetrics,
        [uniqueId]: {
          ...prev.performanceMetrics[uniqueId],
          [playerId]: {
            ...prev.performanceMetrics[uniqueId]?.[playerId],
            [field]: value ? Number(value) : 0
          }
        }
      }
    }));
  };

  // Drill management in session
  const addDrillToSession = (drill) => {
    setForm({ ...form, drills: [...form.drills, { ...drill, uniqueId: Date.now() + Math.random() }] });
    showToastMessage(`Added "${drill.title}" to session!`, "info");
  };

  const removeDrillFromSession = (uniqueId) => {
    setForm(prev => {
      const newMetrics = { ...prev.performanceMetrics };
      delete newMetrics[uniqueId];
      return { ...prev, drills: prev.drills.filter(d => d.uniqueId !== uniqueId), performanceMetrics: newMetrics };
    });
    showToastMessage("Drill removed from session.", "info");
  };

  // Player form handlers
  const handlePlayerChange = (e) => {
    setNewPlayer({ ...newPlayer, [e.target.name]: e.target.value });
  };

  const addPlayer = () => {
    if (newPlayer.name.trim() === "") {
      showToastMessage("Player name cannot be empty.", "error");
      return;
    }
    setPlayers([
      ...players,
      { id: Date.now(), name: newPlayer.name.trim(), jersey: newPlayer.jersey.trim(), performanceHistory: [] }
    ]);
    setNewPlayer({ name: "", jersey: "", performanceHistory: [] });
    showToastMessage(`Player "${newPlayer.name}" added!`);
  };

  const removePlayer = (id) => {
    confirmAction("Are you sure you want to delete this player? This will also remove them from all assigned drills and current session form.", () => {
      setPlayers(players.filter(p => p.id !== id));
      setDrillLibrary(drillLibrary.map(drill => ({
        ...drill,
        assignedPlayers: drill.assignedPlayers.filter(playerId => playerId !== id)
      })));
      setForm(prev => ({
        ...prev,
        drills: prev.drills.map(drill => ({
          ...drill,
          assignedPlayers: drill.assignedPlayers.filter(playerId => playerId !== id)
        })),
        performanceMetrics: {}
      }));
      if (selectedPlayerId === id) setSelectedPlayerId(null);
      showToastMessage("Player deleted successfully.", "success");
    });
  };

  const addPerformanceRecord = () => {
    if (!newPerformance.playerId || !newPerformance.date || !newPerformance.drillId || newPerformance.metrics.shotsAttempted <= 0) {
      showToastMessage("Please select a player, date, drill, and enter valid performance metrics.", "error");
      return;
    }
    setPlayers(prevPlayers => prevPlayers.map(player => {
      if (player.id === newPerformance.playerId) {
        return {
          ...player,
          performanceHistory: [
            ...player.performanceHistory,
            {
              date: newPerformance.date,
              drillId: newPerformance.drillId,
              metrics: newPerformance.metrics
            }
          ]
        };
      }
      return player;
    }));
    setNewPerformance({ playerId: "", date: "", drillId: "", metrics: { shotsMade: 0, shotsAttempted: 0 } });
    showToastMessage("Performance record added!", "success");
  };

  // Add/Update new session
  const addOrUpdateSession = () => {
    if (form.date && form.name) {
      if (editingSessionId !== null) {
        setSessions(
          sessions.map(s =>
            s.id === editingSessionId ? { ...form, id: editingSessionId } : s
          )
        );
        showToastMessage(`Session "${form.name}" updated!`);
        setEditingSessionId(null);
      } else {
        setSessions([...sessions, { ...form, id: Date.now() }]);
        // Update player performance history
        setPlayers(prevPlayers => prevPlayers.map(player => {
          const newHistory = Object.entries(form.performanceMetrics).reduce((acc, [uniqueId, metrics]) => {
            if (metrics[player.id]?.shotsAttempted > 0) {
              acc.push({
                date: form.date,
                drillId: form.drills.find(d => d.uniqueId === Number(uniqueId))?.id,
                metrics: metrics[player.id]
              });
            }
            return acc;
          }, player.performanceHistory || []);
          return { ...player, performanceHistory: newHistory };
        }));
        showToastMessage(`Session "${form.name}" saved!`);
      }
      // Silently clear the form after save (no confirmation modal)
      setForm({
        date: "",
        category: practiceCategories[0],
        name: "",
        drills: [],
        notes: "",
        performanceMetrics: {}
      });
      setEditingSessionId(null);
      setQuickSessionMode(false);
    } else {
      showToastMessage("Please fill in Date and Practice Name.", "error");
    }
  };

  const resetForm = () => {
    if (editingSessionId || form.name || form.drills.length > 0) {
      confirmAction("Are you sure you want to clear the current session form? Any unsaved changes will be lost.", () => {
        setForm({
          date: "",
          category: practiceCategories[0],
          name: "",
          drills: [],
          notes: "",
          performanceMetrics: {}
        });
        setEditingSessionId(null);
        setQuickSessionMode(false);
        showToastMessage("Session form cleared.", "info");
      });
    }
  };

  const editSession = (session) => {
    setEditingSessionId(session.id);
    setForm({ ...session, performanceMetrics: {} });
    setQuickSessionMode(false);
    setActiveSection("practicePlanner");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToastMessage(`Editing session "${session.name}"`, "info");
  };

  const duplicateSession = (session) => {
    const duplicatedSession = {
      ...session,
      id: Date.now(),
      name: `Copy of ${session.name}`,
      date: "",
      drills: session.drills.map(d => ({ ...d, uniqueId: Date.now() + Math.random() })),
      performanceMetrics: {}
    };
    setSessions(prev => [...prev, duplicatedSession]);
    showToastMessage(`Session "${session.name}" duplicated!`);
  };

  const deleteSession = (id) => {
    confirmAction("Are you sure you want to delete this session?", () => {
      setSessions(sessions.filter(s => s.id !== id));
      showToastMessage("Session deleted.", "success");
    });
  };

  // Calculate total duration of drills
  const totalDuration = useCallback(drills =>
    drills.reduce((sum, d) => sum + (Number(d.duration) || 0), 0)
  , []);

  // Drag & drop handlers for reordering drills
  const onDragStart = (e, uniqueId) => {
    e.dataTransfer.setData("dragUniqueId", uniqueId);
  };

  const onDrop = (e, dropUniqueId) => {
    const dragUniqueId = e.dataTransfer.getData("dragUniqueId");
    if (!dragUniqueId) return;

    let drillsCopy = [...form.drills];
    const dragIndex = drillsCopy.findIndex(d => d.uniqueId === Number(dragUniqueId));
    const dropIndex = drillsCopy.findIndex(d => d.uniqueId === Number(dropUniqueId));

    if (dragIndex === -1 || dropIndex === -1) return;

    const draggedDrill = drillsCopy.splice(dragIndex, 1)[0];
    drillsCopy.splice(dropIndex, 0, draggedDrill);
    setForm({ ...form, drills: drillsCopy });
    showToastMessage("Drill reordered!", "info");
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  // Drill Library Management Handlers
  const handleNewDrillChange = (e) => {
    setNewDrill({ ...newDrill, [e.target.name]: e.target.value, preset: "" });
  };

  const handleAssignedPlayersChange = (e, playerId) => {
    const isChecked = e.target.checked;
    setNewDrill(prev => ({
      ...prev,
      assignedPlayers: isChecked
        ? [...prev.assignedPlayers, playerId]
        : prev.assignedPlayers.filter(id => id !== playerId)
    }));
  };

  const addOrUpdateDrill = () => {
    if (newDrill.title.trim() === "" || Number(newDrill.duration) <= 0) {
      showToastMessage("Please enter a valid drill title and positive duration.", "error");
      return;
    }
    if (newDrill.videoUrl && !newDrill.videoUrl.match(/^https?:\/\/.+/)) {
      showToastMessage("Please enter a valid video URL (e.g., https://youtube.com/...).", "error");
      return;
    }

    const drillToSave = { ...newDrill, preset: undefined }; // Remove preset field before saving
    if (editingDrillId !== null) {
      setDrillLibrary(
        drillLibrary.map(d =>
          d.id === editingDrillId ? { ...drillToSave, id: editingDrillId } : d
        )
      );
      showToastMessage(`Drill "${newDrill.title}" updated!`);
      setEditingDrillId(null);
    } else {
      setDrillLibrary([...drillLibrary, { ...drillToSave, id: Date.now() }]);
      showToastMessage(`Drill "${newDrill.title}" added!`);
    }
    setNewDrill({ title: "", duration: "", skill: skillCategories[0], difficulty: difficultyLevels[0], notes: "", assignedPlayers: [], videoUrl: "", preset: "" });
  };

  const editDrill = (drill) => {
    setEditingDrillId(drill.id);
    setNewDrill({ ...drill, preset: drillPresets.some(p => p.title === drill.title) ? drill.title : "" });
    setHighlightDrillForm(true);
    setActiveSection("manageDrills");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToastMessage(`Editing drill "${drill.title}"`, "info");
  };

  const deleteDrill = (id) => {
    confirmAction("Are you sure you want to delete this drill from the library? This will not affect existing sessions that use this drill.", () => {
      setDrillLibrary(drillLibrary.filter(d => d.id !== id));
      showToastMessage("Drill deleted from library.", "success");
    });
  };

  // Filtered Drill Library for display in practice planner (memoized)
  const filteredDrills = useMemo(() => {
    const term = debouncedDrillSearch.toLowerCase();
    return drillLibrary.filter(drill => {
      const matchesSearch = drill.title.toLowerCase().includes(term);
      const matchesSkill = drillFilterSkill === "All" || drill.skill === drillFilterSkill;
      const matchesDifficulty = drillFilterDifficulty === "All" || drill.difficulty === drillFilterDifficulty;
      return matchesSearch && matchesSkill && matchesDifficulty;
    });
  }, [drillLibrary, debouncedDrillSearch, drillFilterSkill, drillFilterDifficulty]);

  // Filtered drills for Manage Drills section (memoized)
  const filteredManageDrills = useMemo(() => {
    const term = debouncedManageSearch.toLowerCase();
    return drillLibrary.filter(drill =>
      drill.title.toLowerCase().includes(term) ||
      (drill.notes && drill.notes.toLowerCase().includes(term))
    );
  }, [drillLibrary, debouncedManageSearch]);

  // Print Session Function
  const printSession = (session) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Practice Session Plan</title>');
    printWindow.document.write('<link rel="stylesheet" href="FlowTrack.css" type="text/css" />');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<div className="print-container">');
    printWindow.document.write(`<h1>Practice Plan: ${session.name}</h1>`);
    printWindow.document.write(`<p><strong>Date:</strong> ${session.date}</p>`);
    printWindow.document.write(`<p><strong>Category:</strong> ${session.category}</p>`);
    if (session.notes) {
      printWindow.document.write(`<p><strong>Notes:</strong> ${session.notes}</p>`);
    }

    printWindow.document.write('<h2>Drills in Session</h2>');
    printWindow.document.write('<ul>');
    session.drills.forEach(drill => {
      const assignedPlayersNames = drill.assignedPlayers
        .map(pId => players.find(p => p.id === pId)?.name)
        .filter(Boolean)
        .join(', ');
      printWindow.document.write(`
        <li>
          <strong>${drill.title}</strong> (${drill.duration} min) - ${drill.skill} - Difficulty: ${drill.difficulty}
          ${assignedPlayersNames ? ` (Assigned: ${assignedPlayersNames})` : ''}
          ${drill.notes ? `<p style="font-size:0.9em; margin-top:5px;"><em>${drill.notes}</em></p>` : ''}
      `);
      if (drill.videoUrl) {
        printWindow.document.write('<div style="margin-top:10px;">');
        printWindow.document.write(`<p style="font-size:0.9em;"><strong>Video:</strong> Scan to view</p>`);
        printWindow.document.write(`<canvas id="qr-${drill.id}"></canvas>`);
        printWindow.document.write('</div>');
      }
      const performance = session.performanceMetrics?.[drill.uniqueId] || {};
      const performanceEntries = Object.entries(performance);
      if (performanceEntries.length > 0) {
        printWindow.document.write('<p style="font-size:0.9em; margin-top:5px;"><strong>Performance:</strong></p>');
        printWindow.document.write('<ul style="font-size:0.85em;">');
        performanceEntries.forEach(([playerId, metrics]) => {
          const player = players.find(p => p.id === Number(playerId));
          if (metrics.shotsAttempted > 0) {
            const percentage = ((metrics.shotsMade / metrics.shotsAttempted) * 100).toFixed(1);
            printWindow.document.write(`<li>${player.name}: ${metrics.shotsMade}/${metrics.shotsAttempted} (${percentage}%)</li>`);
          }
        });
        printWindow.document.write('</ul>');
      }
      printWindow.document.write('</li>');
    });
    printWindow.document.write('</ul>');
    printWindow.document.write(`<p><strong>Total Practice Duration:</strong> ${totalDuration(session.drills)} minutes</p>`);
    printWindow.document.write('</div>');

    printWindow.document.write('<script src="https://cdn.jsdelivr.net/npm/qrcode.react@3.1.0/+esm"></script>');
    printWindow.document.write('<script>');
    session.drills.forEach(drill => {
      if (drill.videoUrl) {
        printWindow.document.write(`
          const canvas = document.getElementById('qr-${drill.id}');
          if (canvas) {
            QRCode.toCanvas(canvas, '${drill.videoUrl}', { width: 100, margin: 1 }, (err) => {
              if (err) console.error(err);
            });
          }
        `);
      }
    });
    printWindow.document.write('</script>');

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Session Template Functions
  const saveSessionAsTemplate = () => {
    const templateName = prompt("Enter a name for this session template:");
    if (templateName && templateName.trim() !== "") {
      const newTemplate = {
        id: Date.now(),
        name: templateName.trim(),
        category: form.category,
        drills: form.drills,
        notes: form.notes,
      };
      setSessionTemplates([...sessionTemplates, newTemplate]);
      showToastMessage(`Template "${templateName}" saved!`);
    } else if (templateName !== null) {
      showToastMessage("Template name cannot be empty.", "error");
    }
  };

  const loadTemplate = (template) => {
    confirmAction(`Are you sure you want to load template "${template.name}"? This will overwrite the current form.`, () => {
      setForm({
        ...form,
        category: template.category,
        name: template.name,
        drills: template.drills.map(d => ({ ...d, uniqueId: Date.now() + Math.random() })),
        notes: template.notes,
        performanceMetrics: {}
      });
      setEditingSessionId(null);
      setQuickSessionMode(false);
      showToastMessage(`Template "${template.name}" loaded successfully!`);
      setActiveSection("practicePlanner");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const deleteTemplate = (id) => {
    confirmAction("Are you sure you want to delete this template?", () => {
      setSessionTemplates(sessionTemplates.filter(t => t.id !== id));
      showToastMessage("Template deleted.", "success");
    });
  };

  // Sort players for display
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => {
    if (playerSortBy === "name") {
      return a.name.localeCompare(b.name);
    } else if (playerSortBy === "jersey") {
      return (Number(a.jersey) || 0) - (Number(b.jersey) || 0);
    }
    return 0;
  }), [players, playerSortBy]);

  // Dashboard Calculations
  const totalSessions = sessions.length;
  const totalPracticeTime = useMemo(() => sessions.reduce((sum, session) => sum + totalDuration(session.drills), 0), [sessions, totalDuration]);

  const sessionsByCategory = useMemo(() => sessions.reduce((acc, session) => {
    acc[session.category] = (acc[session.category] || 0) + 1;
    return acc;
  }, {}), [sessions]);

  const drillUsageBySkill = sessions.reduce((acc, session) => {
    session.drills.forEach(drill => {
      acc[drill.skill] = (acc[drill.skill] || 0) + 1;
    });
    return acc;
  }, {});

  const mostUsedDrills = useMemo(() => Object.entries(drillUsageBySkill)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([skill, count]) => ({ skill, count })), [drillUsageBySkill]);

  // Add drills to session from suggestions
  const addSuggestedDrillsToSession = () => {
    if (suggestedDrills.length === 0) return;
    setForm({
      ...form,
      date: new Date().toISOString().split('T')[0],
      name: `Practice for ${players.find(p => p.id === selectedPlayerId)?.name}`,
      drills: [...form.drills, ...suggestedDrills.map(d => ({ ...d, uniqueId: Date.now() + Math.random() }))],
      performanceMetrics: {}
    });
    setActiveSection("practicePlanner");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToastMessage("Suggested drills added to a new session!", "success");
  };

  return (
    <div className="container">
      <header>
        <div className="brand">
          <img src={Logo} alt="AllBall logo" className="brand-logo" />
          <h1 className="brand-name">AllBall</h1>
        </div>
        <div className="brand-actions">
          {authLoading ? (
            <span className="badge">Loading...</span>
          ) : (
            <>
              {user && (
                <div className="welcome-coach">
                  <span>👋</span>
                  <span>Welcome, {user?.user_metadata?.full_name || user?.email || 'Coach'}</span>
                </div>
              )}
              <span className="badge">Plan: {plan}</span>
              <AuthButtons user={user} />
              {plan === 'free' && (
                <UpgradeButton onClick={() => setShowPaywall(true)} />
              )}
            </>
          )}
        </div>
        {/* Mode Toggle */}
        <div className="mode-toggle" role="group" aria-label="Mode selection">
          <button
            className={`mode-btn ${mode === 'simple' ? 'active' : ''}`}
            onClick={() => setMode('simple')}
            title="Simple mode"
          >
            Simple
          </button>
          <button
            className={`mode-btn ${mode === 'pro' ? 'active' : ''}`}
            onClick={() => setMode('pro')}
            title="Pro mode"
          >
            Pro
          </button>
        </div>
        {mode === 'pro' && (
        <div className="global-search">
          <input
            type="text"
            placeholder="Search drills, players, sessions..."
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            className="global-search-input"
          />
          <button
            className="button small"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            title="Advanced filters"
          >
            {showAdvancedFilters ? "Hide" : "Show"} Filters
          </button>
        </div>
        )}
        {mode === 'pro' && showAdvancedFilters && (
          <div className="advanced-filters">
            <div className="filter-group">
              <label>Skill Focus:</label>
              <select
                value={drillFilterSkill}
                onChange={(e) => setDrillFilterSkill(e.target.value)}
                className="input"
              >
                <option value="All">All Skills</option>
                {skillCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Difficulty:</label>
              <select
                value={drillFilterDifficulty}
                onChange={(e) => setDrillFilterDifficulty(e.target.value)}
                className="input"
              >
                <option value="All">All Levels</option>
                {difficultyLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Duration:</label>
              <select
                className="input"
                onChange={(e) => {
                  // Add duration filtering logic here
                }}
              >
                <option value="All">Any Duration</option>
                <option value="0-10">0-10 min</option>
                <option value="10-20">10-20 min</option>
                <option value="20+">20+ min</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {/* Mode transition wrapper */}
      <div className="mode-section" key={mode}>
      {/* Navigation Menu */}
      <nav className="nav-menu">
        <button
          className={activeSection === "dashboard" ? "active" : ""}
          onClick={() => setActiveSection("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={activeSection === "practicePlanner" ? "active" : ""}
          onClick={() => setActiveSection("practicePlanner")}
        >
          Practice Planner
        </button>
        {(mode === 'simple') && (
            <button
            className={activeSection === "managePlayers" ? "active" : ""}
            onClick={() => setActiveSection("managePlayers")}
          >
            Players
          </button>
        )}
        {mode === 'pro' && (
          <>
            <button
              className={activeSection === "onCourt" ? "active" : ""}
              onClick={() => setActiveSection("onCourt")}
            >
              On-Court
            </button>
            <button
              className={activeSection === "stations" ? "active" : ""}
              onClick={() => setActiveSection("stations")}
            >
              Stations
            </button>
            <button
              className={activeSection === "manageDrills" ? "active" : ""}
              onClick={() => requirePro(plan !== 'free') && setActiveSection("manageDrills")}
            >
              Manage Drills
            </button>
            <button
              className={activeSection === "managePlayers" ? "active" : ""}
              onClick={() => setActiveSection("managePlayers")}
            >
              Manage Players
            </button>
            <button
              className={activeSection === "playerAnalytics" ? "active" : ""}
              onClick={() => requirePro(entitlements.analytics) && setActiveSection("playerAnalytics")}
            >
              Player Analytics
            </button>
          </>
        )}
      </nav>

      {/* Dashboard Section */}
      {activeSection === "dashboard" && (
        <section className="dashboard-section section-transition">
          <h2>Dashboard Overview</h2>
          
          {/* Practice Timer (Pro mode) */}
          {mode === 'pro' && (
            <div className="timer-section">
              <h3>Practice Timer</h3>
              <PracticeTimer
                isActive={timerActive}
                onStart={startTimer}
                onPause={pauseTimer}
                onReset={resetTimer}
                elapsedTime={elapsedTime}
                totalTime={totalDuration(form.drills) * 60}
              />
              {form.drills.length > 0 && (
                <div className="session-progress">
                  <div className="progress-info">
                    <span>Session Progress: {form.drills.length} drills planned</span>
                    <span>Estimated Time: {totalDuration(form.drills)} minutes</span>
                  </div>
                  <div className="skill-distribution">
                    <h4>Skill Focus Distribution</h4>
                    <div className="skill-bars">
                      {Object.entries(
                        form.drills.reduce((acc, drill) => {
                          acc[drill.skill] = (acc[drill.skill] || 0) + Number(drill.duration);
                          return acc;
                        }, {})
                      ).map(([skill, duration]) => (
                        <div key={skill} className="skill-bar">
                          <span className="skill-name">{skill}</span>
                          <div className="skill-bar-container">
                            <div 
                              className="skill-bar-fill" 
                              style={{ 
                                width: `${(duration / totalDuration(form.drills)) * 100}%`,
                                backgroundColor: skill === 'Shooting' ? '#48bb78' : 
                                              skill === 'Defense' ? '#ed8936' : 
                                              skill === 'Passing' ? '#4299e1' : 
                                              skill === 'Dribbling' ? '#9f7aea' : 
                                              skill === 'Conditioning' ? '#f56565' : 
                                              skill === 'Strategy' ? '#38b2ac' : '#718096'
                              }}
                            ></div>
                          </div>
                          <span className="skill-duration">{duration} min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="dashboard-grid">
            <DashboardCard title="Total Sessions" icon="📊" className="stats-card">
              <p className="big-number">{totalSessions}</p>
              <p className="card-subtitle">Practice sessions created</p>
            </DashboardCard>
            
            <DashboardCard title="Total Practice Time" icon="⏱️" className="stats-card">
              <p className="big-number">{totalPracticeTime} min</p>
              <p className="card-subtitle">Cumulative practice time</p>
            </DashboardCard>
            
            <DashboardCard title="Active Players" icon="👥" className="stats-card">
              <p className="big-number">{players.length}</p>
              <p className="card-subtitle">Players on roster</p>
            </DashboardCard>
            
            <DashboardCard title="Drill Library" icon="📚" className="stats-card">
              <p className="big-number">{drillLibrary.length}</p>
              <p className="card-subtitle">Available drills</p>
            </DashboardCard>
          </div>

          {mode === 'pro' && (
          <div className="dashboard-charts">
            <DashboardCard title="Sessions by Category" icon="📈" className="chart-card">
              {Object.keys(sessionsByCategory).length === 0 ? (
                <p className="no-data">No sessions recorded yet.</p>
              ) : (
                <div className="category-stats">
                  {Object.entries(sessionsByCategory).map(([category, count]) => (
                    <div key={category} className="category-item">
                      <span className="category-name">{category}</span>
                      <span className="category-count">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
            
            <DashboardCard title="Drill Usage by Skill" icon="🎯" className="chart-card">
              {mostUsedDrills.length === 0 ? (
                <p className="no-data">No drills used in sessions yet.</p>
              ) : (
                <div className="skill-stats">
                  {mostUsedDrills.map(({ skill, count }) => (
                    <div key={skill} className="skill-item">
                      <span className="skill-name">{skill}</span>
                      <span className="skill-count">{count} times</span>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>
          )}

          {/* Welcome Message for New Users */}
          {sessions.length === 0 && players.length === 0 && (
            <DashboardCard title="Welcome to AllBall! 🏀" icon="🎉" className="welcome-card">
              <div className="welcome-content">
                <p>Get started with your first practice session:</p>
                <div className="quick-actions">
                  <button 
                    className="button primary" 
                    onClick={() => setActiveSection("practicePlanner")}
                  >
                    🎯 Create Your First Practice
                  </button>
                  <button 
                    className="button" 
                    onClick={() => setActiveSection("managePlayers")}
                  >
                    👥 Add Players
                  </button>
                  <button 
                    className="button" 
                    onClick={() => setActiveSection("manageDrills")}
                  >
                    📚 Browse Drill Library
                  </button>
                </div>
                <div className="getting-started-tips">
                  <h4>💡 Quick Tips:</h4>
                  <ul>
                    <li>Start by adding your players to track their progress</li>
                    <li>Browse the drill library to find exercises that match your team's needs</li>
                    <li>Create practice sessions by combining drills and setting durations</li>
                    <li>Use the practice timer to keep sessions on schedule</li>
                  </ul>
                </div>
              </div>
            </DashboardCard>
          )}

          {mode === 'pro' && (
            <DashboardCard title="Quick Stats" icon="📊" className="quick-stats-card">
              <div className="quick-stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{drillLibrary.filter(d => d.skill === "Shooting").length}</div>
                  <div className="stat-label">Shooting Drills</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{drillLibrary.filter(d => d.skill === "Defense").length}</div>
                  <div className="stat-label">Defense Drills</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{drillLibrary.filter(d => d.difficulty === "Advanced").length}</div>
                  <div className="stat-label">Advanced Drills</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sessions.filter(s => s.category === "Skills").length}</div>
                  <div className="stat-label">Skills Sessions</div>
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Recent Activity */}
          <DashboardCard title="Recent Activity" icon="🕒" className="activity-card">
            {sessions.length === 0 ? (
              <p className="no-data">No recent activity</p>
            ) : (
              <div className="recent-sessions">
                {sessions.slice(-3).reverse().map(session => (
                  <div key={session.id} className="recent-session-item">
                    <div className="session-date">{session.date}</div>
                    <div className="session-name">{session.name}</div>
                    <div className="session-category">{session.category}</div>
                    <div className="session-duration">{totalDuration(session.drills)} min</div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </section>
      )}

      {/* On-Court Mode */}
      {activeSection === 'onCourt' && (
        <section className="on-court section-transition">
          <h2>On-Court Mode</h2>
          <label>
            Select Session:
            <select
              className="input"
              value={onCourtSessionId || ''}
              onChange={(e) => {
                const id = Number(e.target.value) || null;
                setOnCourtSessionId(id);
                setOnCourtIndex(0);
                setOnCourtRunning(false);
                setOnCourtRemaining(0);
              }}
            >
              <option value="">Current Form</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.date}</option>
              ))}
            </select>
          </label>
          {(() => {
            const runSession = onCourtSessionId ? sessions.find(s => s.id === onCourtSessionId) : { drills: form.drills, name: form.name || 'Unsaved Session' };
            const drills = runSession?.drills || [];
            const current = drills[onCourtIndex];
            return (
              <>
                {drills.length === 0 ? (
                  <p className="no-data">No drills in this session.</p>
                ) : (
                  <div className="on-court-wrap">
                    <div className="on-court-current">
                      <div className="big-drill-title">{current?.title}</div>
                      <div className="big-drill-meta">{current?.duration} min · {current?.skill} · {current?.difficulty}</div>
                      <div className="big-timer">{Math.floor(onCourtRemaining/60).toString().padStart(2,'0')}:{(onCourtRemaining%60).toString().padStart(2,'0')}</div>
                      <div className="on-court-controls">
                        {!onCourtRunning ? (
                          <button className="button primary" onClick={() => {
                            const start = (Number(current?.duration)||0)*60;
                            setOnCourtRemaining(prev => prev>0 ? prev : start);
                            setOnCourtRunning(true);
                          }}>▶ Start</button>
                        ) : (
                          <button className="button" onClick={() => setOnCourtRunning(false)}>⏸ Pause</button>
                        )}
                        <button className="button" onClick={() => setOnCourtRemaining(prev => prev + 60)}>+1 min</button>
                        <button className="button" onClick={() => setOnCourtRemaining(0)}>Reset</button>
                      </div>
                    </div>
                    <div className="on-court-queue">
                      <h3>Up Next</h3>
                      <ol>
                        {drills.slice(onCourtIndex+1, onCourtIndex+4).map((d, i) => (
                          <li key={i}><strong>{d.title}</strong> — {d.duration} min</li>
                        ))}
                      </ol>
                    <div className="on-court-advance">
                      <button className="button" onClick={() => setOnCourtIndex(i => Math.max(0, i-1))}>⟵ Prev</button>
                      <button className="button" onClick={() => {
                        setOnCourtIndex(i => (i+1 < drills.length ? i+1 : i));
                        setOnCourtRemaining((Number(drills[onCourtIndex+1]?.duration)||0)*60);
                      }}>Next ⟶</button>
                      <button className="button primary" onClick={() => {
                        // Mark Done: jump to next and auto-start with that drill's duration
                        const next = onCourtIndex + 1;
                        if (next < drills.length) {
                          setOnCourtIndex(next);
                          const nextSecs = (Number(drills[next]?.duration) || 0) * 60;
                          setOnCourtRemaining(nextSecs);
                          setOnCourtRunning(true);
                          showToastMessage(`Started: ${drills[next]?.title}`, 'info');
                        } else {
                          setOnCourtRunning(false);
                          setOnCourtRemaining(0);
                          showToastMessage('Session complete!', 'success');
                        }
                      }}>Mark Done ✓</button>
                    </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* Stations / Rotations */}
      {activeSection === 'stations' && (
        <section className="stations-builder section-transition">
          <h2>Stations & Rotations</h2>
          <div className="stations-config">
            <label>
              Number of Stations:
              <input type="number" className="input" min="1" value={numStations} onChange={e => setNumStations(Math.max(1, Number(e.target.value)||1))} />
            </label>
            <label>
              Minutes per Rotation:
              <input type="number" className="input" min="1" value={rotationMinutes} onChange={e => setRotationMinutes(Math.max(1, Number(e.target.value)||1))} />
            </label>
          </div>
          <div className="stations-list">
            {Array.from({ length: numStations }).map((_, idx) => {
              const cfg = stationConfigs[idx] || { id: idx+1, name: `Station ${idx+1}`, drillId: '' };
              return (
                <div key={idx} className="station-item">
                  <input
                    className="input"
                    type="text"
                    value={cfg.name}
                    onChange={e => setStationConfigs(prev => {
                      const next = [...prev];
                      next[idx] = { ...(next[idx]||{}), id: idx+1, name: e.target.value, drillId: cfg.drillId };
                      return next;
                    })}
                    placeholder={`Station ${idx+1} name`}
                  />
                  <select
                    className="input"
                    value={cfg.drillId || ''}
                    onChange={e => setStationConfigs(prev => {
                      const next = [...prev];
                      next[idx] = { ...(next[idx]||{}), id: idx+1, name: cfg.name, drillId: Number(e.target.value)||'' };
                      return next;
                    })}
                  >
                    <option value="">Select a drill</option>
                    {drillLibrary.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="button-group">
            <button className="button primary" onClick={() => {
              const playersList = [...players];
              if (playersList.length === 0) { showToastMessage('Add players first.', 'error'); return; }
              const groups = Array.from({ length: numStations }).map(() => []);
              playersList.forEach((p, i) => { groups[i % numStations].push(p.id); });
              const rounds = numStations;
              const schedule = Array.from({ length: rounds }).map((_, r) => Array.from({ length: numStations }).map((__, s) => (s + r) % numStations));
              setGeneratedGroups(groups);
              setGeneratedSchedule(schedule);
              showToastMessage('Station schedule generated.', 'success');
            }}>Generate Schedule</button>
          </div>
          {generatedSchedule.length > 0 && (
            <div className="stations-schedule">
              <h3>Rotation Schedule ({rotationMinutes} min per station)</h3>
              <div className="schedule-grid">
                <div className="schedule-header">Round</div>
                {Array.from({ length: numStations }).map((_, s) => (
                  <div key={s} className="schedule-header">Station {s+1}</div>
                ))}
                {generatedSchedule.map((row, r) => (
                  <React.Fragment key={r}>
                    <div className="schedule-cell strong">{r+1}</div>
                    {row.map((groupIndex, s) => (
                      <div key={`${r}-${s}`} className="schedule-cell">
                        <div className="cell-station-name">{(stationConfigs[s]?.name) || `Station ${s+1}`}</div>
                        <div className="cell-drill">{drillLibrary.find(d => d.id === (stationConfigs[s]?.drillId))?.title || '—'}</div>
                        <div className="cell-group">{generatedGroups[groupIndex].map(pid => players.find(p => p.id === pid)?.name).filter(Boolean).join(', ')}</div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {/* Practice Planner Section */}
      {activeSection === "practicePlanner" && (
        <>
          <section className="session-form section-transition">
            <h2>{mode === 'simple' ? "Plan a Practice" : quickSessionMode ? "Quick Session Setup" : editingSessionId ? "Edit Practice Session" : "New Practice Session"}</h2>
            {mode === 'pro' && (
              <div className="session-mode-toggle">
                <button
                  className={`button small ${quickSessionMode ? '' : 'active'}`}
                  onClick={() => setQuickSessionMode(false)}
                >
                  Full Planner
                </button>
                <button
                  className={`button small ${quickSessionMode ? 'active' : ''}`}
                  onClick={() => {
                    setQuickSessionMode(true);
                    setForm({ ...form, drills: [], performanceMetrics: {} });
                  }}
                >
                  Quick Session
                </button>
              </div>
            )}
            {(mode === 'simple' || quickSessionMode) ? (
              <div className="quick-session-form">
                <label>
                  Date:
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="input"
                  />
                </label>
                <label>
                  Practice Name:
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter practice name"
                    value={form.name}
                    onChange={handleChange}
                    className="input"
                  />
                </label>
                <label>
                  Practice Category:
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="input"
                  >
                    {practiceCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                {/* Drill Filter (Quick Session) */}
                <div className="drill-filter">
                  <label className="full">
                    Search:
                    <input
                      type="text"
                      placeholder="Search drills..."
                      value={drillSearchTerm}
                      onChange={e => setDrillSearchTerm(e.target.value)}
                      className="input"
                    />
                  </label>
                  <FilterChips
                    label="Skill"
                    options={skillCategories}
                    active={drillFilterSkill}
                    onChange={setDrillFilterSkill}
                  />
                  <FilterChips
                    label="Difficulty"
                    options={difficultyLevels}
                    active={drillFilterDifficulty}
                    onChange={setDrillFilterDifficulty}
                  />
                </div>

                {/* Drill Library (Quick Session) */}
                <div className="drill-library">
                  <h3>Drill Library</h3>
                  {filteredDrills.length === 0 && <p className="no-data">No drills available matching criteria.</p>}
                  <div className="drill-grid">
                    {isFilteringDrills && (
                      <>
                        <div className="skeleton-card" />
                        <div className="skeleton-card" />
                        <div className="skeleton-card" />
                      </>
                    )}
                    {!isFilteringDrills && filteredDrills.map(drill => (
                      <DrillCard
                        key={drill.id}
                        drill={drill}
                        onAdd={addDrillToSession}
                        onView={showVideo}
                        showAddButton={true}
                        showVideo={true}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label>
                  Date:
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="input"
                  />
                </label>
                <label>
                  Practice Category:
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="input"
                  >
                    {practiceCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Practice Name:
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter practice name"
                    value={form.name}
                    onChange={handleChange}
                    className="input"
                  />
                </label>
                <label>
                  Session Notes:
                  <textarea
                    name="notes"
                    placeholder="Add session notes..."
                    value={form.notes}
                    onChange={handleChange}
                    className="input textarea"
                  />
                </label>

                {/* Drill Filter */}
                <div className="drill-filter">
                  <label className="full">
                    Search:
                    <input
                      type="text"
                      placeholder="Search drills..."
                      value={drillSearchTerm}
                      onChange={e => setDrillSearchTerm(e.target.value)}
                      className="input"
                    />
                  </label>
                  <FilterChips
                    label="Skill"
                    options={skillCategories}
                    active={drillFilterSkill}
                    onChange={setDrillFilterSkill}
                  />
                  <FilterChips
                    label="Difficulty"
                    options={difficultyLevels}
                    active={drillFilterDifficulty}
                    onChange={setDrillFilterDifficulty}
                  />
                </div>

                {/* Drill Library */}
                <div className="drill-library">
                  <h3>Drill Library</h3>
                  {filteredDrills.length === 0 && <p className="no-data">No drills available matching criteria.</p>}
                  <div className="drill-grid">
                    {isFilteringDrills && (
                      <>
                        <div className="skeleton-card" />
                        <div className="skeleton-card" />
                        <div className="skeleton-card" />
                      </>
                    )}
                    {!isFilteringDrills && filteredDrills.map(drill => (
                      <DrillCard
                        key={drill.id}
                        drill={drill}
                        onAdd={addDrillToSession}
                        onView={showVideo}
                        showAddButton={true}
                        showVideo={true}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Drills in Session */}
            <div className="session-drills">
              <div className="session-drills-header">
                <h3>Drills in Session (Drag to reorder)</h3>
                {form.drills.length > 0 && (
                  <div className="session-summary">
                    <span className="summary-item">
                      <strong>Total Time:</strong> {totalDuration(form.drills)} min
                    </span>
                    <span className="summary-item">
                      <strong>Drills:</strong> {form.drills.length}
                    </span>
                    <span className="summary-item">
                      <strong>Skills:</strong> {[...new Set(form.drills.map(d => d.skill))].join(', ')}
                    </span>
                  </div>
                )}
              </div>
              {form.drills.length === 0 && (
                <p className="no-data">No drills added yet.</p>
              )}
              <ul>
                {form.drills.map(drill => (
                  <li
                    key={drill.uniqueId}
                    className="drill-item draggable"
                    draggable
                    onDragStart={e => onDragStart(e, drill.uniqueId)}
                    onDrop={e => onDrop(e, drill.uniqueId)}
                    onDragOver={onDragOver}
                  >
                    <div>
                      <strong>{drill.title}</strong> ({drill.duration} min) - {drill.skill} - {drill.difficulty}
                      {drill.assignedPlayers?.length > 0 && (
                        <div className="assign-players" style={{ marginTop: '5px' }}>
                          Assigned: {drill.assignedPlayers.map(pId => players.find(p => p.id === pId)?.name).filter(Boolean).join(', ')}
                        </div>
                      )}
                      {mode === 'pro' && drill.videoUrl && (
                        <button
                          className="button small"
                          onClick={() => showVideo(drill.videoUrl)}
                          title="View drill video"
                          style={{ marginTop: '5px' }}
                        >
                          ▶
                        </button>
                      )}
                      {/* Performance Metrics Input */}
                      {mode === 'pro' && drill.assignedPlayers?.length > 0 && (
                        <div className="performance-inputs" style={{ marginTop: '10px' }}>
                          <h4 style={{ fontSize: '0.95rem', margin: '5px 0' }}>Performance Metrics</h4>
                          {drill.assignedPlayers.map(playerId => {
                            const player = players.find(p => p.id === playerId);
                            const metrics = form.performanceMetrics[drill.uniqueId]?.[playerId] || { shotsMade: 0, shotsAttempted: 0 };
                            return (
                              <div key={playerId} style={{ marginBottom: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span>{player.name}:</span>
                                <input
                                  type="number"
                                  placeholder="Made"
                                  value={metrics.shotsMade || ''}
                                  onChange={e => handlePerformanceChange(drill.uniqueId, playerId, 'shotsMade', e.target.value)}
                                  className="input"
                                  style={{ width: '80px' }}
                                  min="0"
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  placeholder="Attempted"
                                  value={metrics.shotsAttempted || ''}
                                  onChange={e => handlePerformanceChange(drill.uniqueId, playerId, 'shotsAttempted', e.target.value)}
                                  className="input"
                                  style={{ width: '80px' }}
                                  min="0"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      className="button small danger"
                      onClick={() => removeDrillFromSession(drill.uniqueId)}
                      title="Remove drill"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                <strong>Total Duration:</strong> {totalDuration(form.drills)} minutes
              </p>
            </div>

            <div className="button-group">
              <button className="button primary" onClick={addOrUpdateSession}>
                {editingSessionId ? "Save Session Changes" : "Save Practice Session"}
              </button>
              <button className="button small" onClick={resetForm}>
                {editingSessionId ? "Cancel Edit" : "Clear Form"}
              </button>
              {mode === 'pro' && plan !== 'free' && (
                <button className="button small" onClick={() => requirePro(entitlements.templates) && saveSessionAsTemplate()}>
                  Save as Template
                </button>
              )}
            </div>
          </section>

          {/* Session Templates Section */}
          {mode === 'pro' && (
          <section className="session-templates section-transition">
            <h2>Session Templates</h2>
            {sessionTemplates.length === 0 && <p>No templates saved yet.</p>}
            <ul>
              {sessionTemplates.map(template => (
                <li key={template.id} className="session-item">
                  <div>
                    <strong>{template.name}</strong> ({template.drills.length} drills, {totalDuration(template.drills)} min)
                    <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>{template.notes || "No notes"}</p>
                  </div>
                  <div className="session-actions">
                    <button
                      className="button small"
                      onClick={() => loadTemplate(template)}
                      title="Load template"
                    >
                      Load
                    </button>
                    <button
                      className="button small danger"
                      onClick={() => deleteTemplate(template.id)}
                      title="Delete template"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          )}

          {/* Scheduled Sessions */}
          <section className="session-list section-transition">
            <h2>Scheduled Practice Sessions</h2>
            {sessions.length === 0 && <p>No practice sessions scheduled.</p>}
            <ul>
              {sessions.map(session => (
                <li key={session.id} className="session-item">
                  <div className="session-details">
                    <strong>{session.name}</strong> — {session.date} — {session.category}
                    <div>
                      <em>Notes:</em> {session.notes || "No notes"}
                    </div>
                    <div>
                      Drills ({session.drills.length}, Total: {totalDuration(session.drills)} min):
                      <ul>
                        {session.drills.map((drill, j) => (
                          <li key={j}>
                            {drill.title} ({drill.duration} min) — {drill.skill} — {drill.difficulty}
                            {drill.assignedPlayers?.length > 0 && (
                              <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '8px' }}>
                                (Assigned: {drill.assignedPlayers.map(pId => players.find(p => p.id === pId)?.name).filter(Boolean).join(', ')})
                              </span>
                            )}
                            {drill.videoUrl && (
                              <button
                                className="button small"
                                onClick={() => showVideo(drill.videoUrl)}
                                title="View drill video"
                                style={{ marginLeft: '8px' }}
                              >
                                ▶
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {session.performanceMetrics && Object.keys(session.performanceMetrics).length > 0 && (
                      <div>
                        <em>Performance Metrics:</em>
                        <ul>
                          {Object.entries(session.performanceMetrics).map(([uniqueId, metrics]) => {
                            const drill = session.drills.find(d => d.uniqueId === Number(uniqueId));
                            return Object.entries(metrics).map(([playerId, data]) => {
                              const player = players.find(p => p.id === Number(playerId));
                              if (data.shotsAttempted > 0) {
                                const percentage = ((data.shotsMade / data.shotsAttempted) * 100).toFixed(1);
                                return (
                                  <li key={`${uniqueId}-${playerId}`}>
                                    {player.name} in {drill.title}: {data.shotsMade}/{data.shotsAttempted} ({percentage}%)
                                  </li>
                                );
                              }
                              return null;
                            });
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="session-actions">
                    <button
                      className="button small"
                      onClick={() => editSession(session)}
                      title="Edit session"
                    >
                      Edit
                    </button>
                    <button
                      className="button small"
                      onClick={() => duplicateSession(session)}
                      title="Duplicate session"
                    >
                      Duplicate
                    </button>
                    <button
                      className="button small"
                      onClick={() => printSession(session)}
                      title="Print session"
                    >
                      Print
                    </button>
                    <button
                      className="button small danger"
                      onClick={() => deleteSession(session.id)}
                      title="Delete session"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Manage Drills Section */}
      {mode === 'pro' && activeSection === "manageDrills" && (
        <section className="drill-management section-transition">
          <h2>Manage Drills</h2>
          <div className={`add-drill-form ${highlightDrillForm ? 'edit-highlight' : ''}`}>
            <label className="full-width">
              Select Preset or Custom:
              <select
                name="preset"
                value={newDrill.preset || ""}
                onChange={(e) => {
                  const preset = drillPresets.find(p => p.title === e.target.value);
                  if (preset) {
                    setNewDrill({ ...preset, preset: e.target.value });
                  } else {
                    setNewDrill({ title: "", duration: "", skill: skillCategories[0], difficulty: difficultyLevels[0], notes: "", assignedPlayers: [], videoUrl: "", preset: "" });
                  }
                }}
                className="input"
              >
                <option value="">Custom Drill</option>
                {drillPresets.map(preset => (
                  <option key={preset.title} value={preset.title}>{preset.title}</option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Drill Title:
              <input
                type="text"
                name="title"
                placeholder="e.g., Layup Progression"
                value={newDrill.title}
                onChange={handleNewDrillChange}
                className="input"
              />
            </label>
            <label>
              Duration (min):
              <input
                type="number"
                name="duration"
                placeholder="e.g., 10"
                value={newDrill.duration}
                onChange={handleNewDrillChange}
                className="input"
                min="1"
              />
            </label>
            <label>
              Skill Category:
              <select
                name="skill"
                value={newDrill.skill}
                onChange={handleNewDrillChange}
                className="input"
              >
                {skillCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label>
              Difficulty:
              <select
                name="difficulty"
                value={newDrill.difficulty}
                onChange={handleNewDrillChange}
                className="input"
              >
                {difficultyLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Video URL (e.g., YouTube):
              <input
                type="text"
                name="videoUrl"
                placeholder="e.g., https://youtube.com/watch?v=..."
                value={newDrill.videoUrl}
                onChange={handleNewDrillChange}
                className="input"
              />
            </label>
            <label className="full-width">
              Notes:
              <textarea
                name="notes"
                placeholder="Key teaching points, variations..."
                value={newDrill.notes}
                onChange={handleNewDrillChange}
                className="input textarea"
              />
            </label>
            <div className="full-width">
              <label>Assign Players to this Drill:</label>
              <div className="assign-players">
                {players.length === 0 && <p>No players added yet. Add players in "Manage Players" section.</p>}
                {players.map(player => (
                  <label key={player.id} className="player-checkbox">
                    <input
                      type="checkbox"
                      checked={newDrill.assignedPlayers.includes(player.id)}
                      onChange={e => handleAssignedPlayersChange(e, player.id)}
                    />
                    {player.name} {player.jersey && `(#${player.jersey})`}
                  </label>
                ))}
              </div>
            </div>
            <div className="full-width">
              <button className="button primary" onClick={addOrUpdateDrill}>
                {editingDrillId ? "Save Drill Changes" : "Add New Drill"}
              </button>
              {editingDrillId && (
                <button
                  className="button small"
                  onClick={() => {
                    setEditingDrillId(null);
                    setNewDrill({ title: "", duration: "", skill: skillCategories[0], difficulty: difficultyLevels[0], notes: "", assignedPlayers: [], videoUrl: "", preset: "" });
                    showToastMessage("Drill edit cancelled.", "info");
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
          <div className="drill-filter">
            <label>
              Search Drills:
              <input
                type="text"
                placeholder="Search drills by title or notes..."
                value={manageDrillSearchTerm}
                onChange={e => setManageDrillSearchTerm(e.target.value)}
                className="input"
              />
            </label>
          </div>
          <h3 className="drill-list-heading">Existing Drills</h3>
          <div className="drill-grid">
            {isFilteringManage && (
              <>
                <div className="skeleton-card" />
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </>
            )}
            {!isFilteringManage && filteredManageDrills.length === 0 && <p className="no-data">No drills in library matching your search criteria.</p>}
            {!isFilteringManage && filteredManageDrills.map(drill => (
              <div key={drill.id} className="manage-drill-item">
                <DrillCard
                  drill={drill}
                  onAdd={() => {}}
                  onView={showVideo}
                  showAddButton={false}
                  showVideo={true}
                />
                <div className="drill-management-actions">
                  <button
                    className="button small"
                    onClick={() => editDrill(drill)}
                    title="Edit drill"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="button small danger"
                    onClick={() => deleteDrill(drill.id)}
                    title="Delete drill"
                  >
                    🗑️ Delete
                  </button>
                </div>
                {drill.assignedPlayers?.length > 0 && (
                  <div className="assigned-players">
                    <strong>Assigned Players:</strong>
                    <div className="player-tags">
                      {drill.assignedPlayers.map(pId => {
                        const player = players.find(p => p.id === pId);
                        return player ? (
                          <span key={pId} className="player-tag">
                            {player.name} {player.jersey && `#${player.jersey}`}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manage Players Section */}
      {activeSection === "managePlayers" && (
        <section className="player-management section-transition">
          <h2>Manage Players</h2>
          <div className="player-form">
            <input
              type="text"
              name="name"
              placeholder="Player name"
              value={newPlayer.name}
              onChange={handlePlayerChange}
              className="input"
            />
            <input
              type="text"
              name="jersey"
              placeholder="Jersey number"
              value={newPlayer.jersey}
              onChange={handlePlayerChange}
              className="input"
            />
            <button className="button primary" onClick={addPlayer}>
              Add Player
            </button>
          </div>
          <div className="performance-form">
            <h3>Add Performance Record</h3>
            <label>
              Select Player:
              <select
                value={newPerformance.playerId || ""}
                onChange={e => setNewPerformance({ ...newPerformance, playerId: Number(e.target.value) || "" })}
                className="input"
              >
                <option value="">Select a player</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name} {player.jersey && `(#${player.jersey})`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date:
              <input
                type="date"
                name="date"
                value={newPerformance.date}
                onChange={e => setNewPerformance({ ...newPerformance, date: e.target.value })}
                className="input"
              />
            </label>
            <label>
              Drill:
              <select
                value={newPerformance.drillId || ""}
                onChange={e => setNewPerformance({ ...newPerformance, drillId: Number(e.target.value) || "" })}
                className="input"
              >
                <option value="">Select a drill</option>
                {drillLibrary.map(drill => (
                  <option key={drill.id} value={drill.id}>{drill.title}</option>
                ))}
              </select>
            </label>
            <label>
              Shots Made:
              <input
                type="number"
                placeholder="Shots Made"
                value={newPerformance.metrics.shotsMade || ''}
                onChange={e => setNewPerformance({ ...newPerformance, metrics: { ...newPerformance.metrics, shotsMade: Number(e.target.value) || 0 } })}
                className="input"
                min="0"
              />
            </label>
            <label>
              Shots Attempted:
              <input
                type="number"
                placeholder="Shots Attempted"
                value={newPerformance.metrics.shotsAttempted || ''}
                onChange={e => setNewPerformance({ ...newPerformance, metrics: { ...newPerformance.metrics, shotsAttempted: Number(e.target.value) || 0 } })}
                className="input"
                min="0"
              />
            </label>
            <button className="button primary" onClick={addPerformanceRecord}>
              Add Performance
            </button>
          </div>
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ marginBottom: 0, flexShrink: 0 }}>Sort by:</label>
            <select
              value={playerSortBy}
              onChange={e => setPlayerSortBy(e.target.value)}
              className="input"
              style={{ maxWidth: '150px', marginLeft: 0 }}
            >
              <option value="name">Name</option>
              <option value="jersey">Jersey Number</option>
            </select>
          </div>
          <ul className="player-list">
            {players.length === 0 && <p>No players added.</p>}
            {sortedPlayers.map(p => (
              <li key={p.id}>
                {p.name} {p.jersey && `#${p.jersey}`}
                <button
                  className="button small danger"
                  onClick={() => removePlayer(p.id)}
                  title="Remove Player"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Player Analytics Section */}
      {mode === 'pro' && activeSection === "playerAnalytics" && (
        <section className="player-analytics section-transition">
          <h2>Player Analytics</h2>
          <label>
            Select Player:
            <select
              value={selectedPlayerId || ""}
              onChange={e => setSelectedPlayerId(Number(e.target.value) || null)}
              className="input"
            >
              <option value="">Select a player</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name} {player.jersey && `(#${player.jersey})`}
                </option>
              ))}
            </select>
          </label>
          {selectedPlayerId && (
            <div className="analytics-content">
              <div className="dashboard-card summary-card">
                <h3>{players.find(p => p.id === selectedPlayerId)?.name}'s Performance Summary</h3>
                {players.find(p => p.id === selectedPlayerId)?.performanceHistory?.length === 0 ? (
                  <p>No performance data available for this player.</p>
                ) : (
                  <>
                    <p>
                      <strong>Average Shooting:</strong> 
                      {(() => {
                        const player = players.find(p => p.id === selectedPlayerId);
                        const totalMade = player.performanceHistory.reduce((sum, r) => sum + r.metrics.shotsMade, 0);
                        const totalAttempted = player.performanceHistory.reduce((sum, r) => sum + r.metrics.shotsAttempted, 0);
                        return totalAttempted > 0 ? `${((totalMade / totalAttempted) * 100).toFixed(1)}%` : "N/A";
                      })()}
                    </p>
                    <p>
                      <strong>Latest Performance:</strong> 
                      {(() => {
                        const player = players.find(p => p.id === selectedPlayerId);
                        const latest = player.performanceHistory[player.performanceHistory.length - 1];
                        if (!latest) return "No data";
                        const drill = drillLibrary.find(d => d.id === latest.drillId);
                        return `${drill?.title || "Drill"} on ${latest.date}: ${latest.metrics.shotsMade}/${latest.metrics.shotsAttempted} (${((latest.metrics.shotsMade / latest.metrics.shotsAttempted) * 100).toFixed(1)}%)`;
                      })()}
                    </p>
                    <button
                      className="button small"
                      onClick={() => {
                        const player = players.find(p => p.id === selectedPlayerId);
                        const totalMade = player.performanceHistory.reduce((sum, r) => sum + r.metrics.shotsMade, 0);
                        const totalAttempted = player.performanceHistory.reduce((sum, r) => sum + r.metrics.shotsAttempted, 0);
                        const avgPercentage = totalAttempted > 0 ? (totalMade / totalAttempted) * 100 : 0;
                        if (avgPercentage < 60) {
                          const shootingDrills = drillLibrary.filter(d => d.skill === "Shooting").slice(0, 3);
                          setSuggestedDrills(shootingDrills);
                          setShowSuggestedDrills(true);
                        } else {
                          setSuggestedDrills([]);
                          setShowSuggestedDrills(true);
                        }
                      }}
                    >
                      {showSuggestedDrills ? "Hide Suggestions" : "Show Suggested Drills"}
                    </button>
                  </>
                )}
              </div>
              <div className="dashboard-card chart-card">
                <h3>Shooting Performance <span className="tooltip">ℹ<span className="tooltip-text">Track shooting percentage over time. Hover over points for details.</span></span></h3>
                {players.find(p => p.id === selectedPlayerId)?.performanceHistory?.length === 0 ? (
                  <p>No performance data available for this player.</p>
                ) : (
                  <canvas id="shootingChart" style={{ maxHeight: '300px' }}></canvas>
                )}
              </div>
              {showSuggestedDrills && (
                <div className="dashboard-card suggested-drills-card">
                  <h3>Suggested Drills for {players.find(p => p.id === selectedPlayerId)?.name}</h3>
                  {suggestedDrills.length > 0 ? (
                    <>
                      <p>Based on your shooting performance, try these drills to improve:</p>
                      <ul>
                        {suggestedDrills.map(drill => (
                          <li key={drill.id}>
                            <strong>{drill.title}</strong> ({drill.duration} min) - {drill.difficulty}
                            {drill.notes && <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>{drill.notes}</p>}
                            {drill.videoUrl && (
                              <button
                                className="button small"
                                onClick={() => showVideo(drill.videoUrl)}
                                title="View drill video"
                                style={{ marginLeft: '10px' }}
                              >
                                ▶
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        className="button primary"
                        onClick={addSuggestedDrillsToSession}
                      >
                        Add to New Session
                      </button>
                    </>
                  ) : (
                    <p>Performance looks solid! Consider advanced drills to keep improving.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      </div>

      {/* Modal and Toast Components */}
      <Modal
        show={showModal}
        message={modalMessage}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        videoUrl={modalVideoUrl}
        title="AllBall"
      />
      {showPaywall && (
        <Paywall
          title="Unlock Pro Features"
          features={[
            'Manage full drill library',
            'Player analytics and charts',
            'Session templates and quick reuse',
            'Calendar and export-ready plans'
          ]}
          onClose={() => setShowPaywall(false)}
          onUpgrade={() => {
            // If the billing server isn’t configured yet, show a friendly message
            // You can wire this to POST /create-checkout-session when Stripe is ready
            alert('Upgrade flow coming soon. For now, set your plan to "pro" in Supabase profiles to unlock.');
            setShowPaywall(false);
          }}
        />
      )}
      <Toast
        show={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}