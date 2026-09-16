package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"agentic-ai-backend/config"
	"agentic-ai-backend/models"
)

var validTaskStatuses = map[string]bool{
	"todo":        true,
	"in progress": true,
	"done":        true,
	"canceled":    true,
	"backlog":     true,
}

var validTaskLabels = map[string]bool{
	"bug":           true,
	"feature":       true,
	"documentation": true,
}

var validTaskPriorities = map[string]bool{
	"low":      true,
	"medium":   true,
	"high":     true,
	"critical": true,
}

// ============================================================
// REQUEST
// ============================================================

type taskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Label       string `json:"label"`
	Priority    string `json:"priority"`
	AgentID     *uint  `json:"agent_id"`
}

type taskPatchRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Label       *string `json:"label"`
	Priority    *string `json:"priority"`
	AgentID     *uint   `json:"agent_id"`
}

// ============================================================
// GET TASKS
// ============================================================

func GetTasks(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var tasks []models.Task

	err := config.DB.
		Preload("Agent").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&tasks).
		Error

	if err != nil {
		c.Error(err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal mengambil task.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":    true,
		"tasks": tasks,
	})
}

// ============================================================
// CREATE TASK
// ============================================================

func CreateTask(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var req taskRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Format data task tidak valid.",
		})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	req.Label = strings.ToLower(strings.TrimSpace(req.Label))
	req.Priority = strings.ToLower(strings.TrimSpace(req.Priority))

	if req.Status == "" {
		req.Status = "todo"
	}

	if req.Label == "" {
		req.Label = "feature"
	}

	if req.Priority == "" {
		req.Priority = "medium"
	}

	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Judul task wajib diisi.",
		})
		return
	}

	if !validTaskStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Status task tidak valid.",
		})
		return
	}

	if !validTaskLabels[req.Label] {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Label task tidak valid.",
		})
		return
	}

	if !validTaskPriorities[req.Priority] {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Priority task tidak valid.",
		})
		return
	}

	// ========================================================
	// VALIDATE AGENT
	// ========================================================

	if req.AgentID != nil {
		var agent models.Agent

		err := config.DB.
			Where(
				"id = ? AND is_active = ?",
				*req.AgentID,
				true,
			).
			First(&agent).
			Error

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Agent tidak ditemukan.",
			})
			return
		}
	}

	// ========================================================
	// CREATE
	// ========================================================

	task := models.Task{
		UserID:      userID,
		AgentID:     req.AgentID,
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Label:       req.Label,
		Priority:    req.Priority,
	}

	if err := config.DB.Create(&task).Error; err != nil {
		c.Error(err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal membuat task.",
		})
		return
	}

	config.DB.
		Preload("Agent").
		First(&task, task.ID)

	c.JSON(http.StatusCreated, gin.H{
		"ok":   true,
		"task": task,
	})
}

// ============================================================
// UPDATE TASK
// ============================================================

func UpdateTask(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	taskID, err := strconv.ParseUint(
		c.Param("id"),
		10,
		64,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "ID task tidak valid.",
		})
		return
	}

	var task models.Task

	err = config.DB.
		Where(
			"id = ? AND user_id = ?",
			taskID,
			userID,
		).
		First(&task).
		Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Task tidak ditemukan.",
		})
		return
	}

	var req taskPatchRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Format data tidak valid.",
		})
		return
	}

	// ========================================================
	// TITLE
	// ========================================================

	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)

		if title == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Judul task wajib diisi.",
			})
			return
		}

		task.Title = title
	}

	// ========================================================
	// DESCRIPTION
	// ========================================================

	if req.Description != nil {
		task.Description = strings.TrimSpace(*req.Description)
	}

	// ========================================================
	// STATUS
	// ========================================================

	if req.Status != nil {
		status := strings.ToLower(strings.TrimSpace(*req.Status))

		if !validTaskStatuses[status] {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Status task tidak valid.",
			})
			return
		}

		task.Status = status
	}

	// ========================================================
	// LABEL
	// ========================================================

	if req.Label != nil {
		label := strings.ToLower(strings.TrimSpace(*req.Label))

		if !validTaskLabels[label] {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Label task tidak valid.",
			})
			return
		}

		task.Label = label
	}

	// ========================================================
	// PRIORITY
	// ========================================================

	if req.Priority != nil {
		priority := strings.ToLower(strings.TrimSpace(*req.Priority))

		if !validTaskPriorities[priority] {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Priority task tidak valid.",
			})
			return
		}

		task.Priority = priority
	}

	// ========================================================
	// AGENT
	// ========================================================

	if req.AgentID != nil {
		var agent models.Agent

		err := config.DB.
			Where(
				"id = ? AND is_active = ?",
				*req.AgentID,
				true,
			).
			First(&agent).
			Error

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Agent tidak ditemukan.",
			})
			return
		}

		task.AgentID = req.AgentID
	}

	// ========================================================
	// SAVE
	// ========================================================

	if err := config.DB.Save(&task).Error; err != nil {
		c.Error(err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memperbarui task.",
		})
		return
	}

	config.DB.
		Preload("Agent").
		First(&task, task.ID)

	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"task": task,
	})
}

// ============================================================
// DELETE TASK
// ============================================================

func DeleteTask(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	taskID, err := strconv.ParseUint(
		c.Param("id"),
		10,
		64,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "ID task tidak valid.",
		})
		return
	}

	result := config.DB.
		Where(
			"id = ? AND user_id = ?",
			taskID,
			userID,
		).
		Delete(&models.Task{})

	if result.Error != nil {
		c.Error(result.Error)

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menghapus task.",
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Task tidak ditemukan.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"message": "Task berhasil dihapus.",
	})
}