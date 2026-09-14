package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"agentic-ai-backend/config"
	"agentic-ai-backend/models"
)

// ============================================================
// REQUEST
// ============================================================

type createAIModelRequest struct {
	ProviderID  uint   `json:"provider_id"`
	Name        string `json:"name"`
	ModelID     string `json:"model_id"`
	Description string `json:"description"`
	AgentIDs    []uint `json:"agent_ids"`
}

type updateAIModelRequest struct {
	Name        *string `json:"name"`
	ModelID     *string `json:"model_id"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"is_active"`
	AgentIDs    *[]uint `json:"agent_ids"`
}

type removeModelFromAgentRequest struct {
	AgentID uint `json:"agent_id"`
}

// ============================================================
// GET ALL AI MODELS
// ============================================================

func GetAIModels(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var aiModels []models.AIModel

	err := config.DB.
		Preload("Provider").
		Preload("Agents").
		Where(`
			is_system = ?
			OR user_id = ?
		`, true, userID).
		Where("deleted_at IS NULL").
		Order("is_system DESC, name ASC").
		Find(&aiModels).
		Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal mengambil model AI.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":     true,
		"models": aiModels,
	})
}

// ============================================================
// CREATE AI MODEL
// ============================================================

func CreateAIModel(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var req createAIModelRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Data model tidak valid.",
		})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.ModelID = strings.TrimSpace(req.ModelID)
	req.Description = strings.TrimSpace(req.Description)

	if req.ProviderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Provider wajib dipilih.",
		})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Nama model wajib diisi.",
		})
		return
	}

	if req.ModelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Model ID wajib diisi.",
		})
		return
	}

	// ============================================================
	// VALIDATE PROVIDER
	// ============================================================

	var provider models.AIProvider

	err := config.DB.
		Where(`
			id = ?
			AND is_active = ?
			AND (
				is_system = ?
				OR user_id = ?
			)
		`,
			req.ProviderID,
			true,
			true,
			userID,
		).
		First(&provider).
		Error

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"ok":    false,
			"error": "Provider tidak ditemukan atau tidak dapat digunakan.",
		})
		return
	}

	// ============================================================
	// CHECK DUPLICATE MODEL
	// ============================================================

	var duplicate int64

	err = config.DB.
		Model(&models.AIModel{}).
		Where(`
			provider_id = ?
			AND model_id = ?
			AND deleted_at IS NULL
		`,
			req.ProviderID,
			req.ModelID,
		).
		Count(&duplicate).
		Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memeriksa model.",
		})
		return
	}

	if duplicate > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"ok":    false,
			"error": "Model ID tersebut sudah ada pada provider ini.",
		})
		return
	}

	// ============================================================
	// CREATE MODEL
	// ============================================================

	aiModel := models.AIModel{
		ProviderID:  req.ProviderID,
		UserID:      &userID,
		Name:        req.Name,
		ModelID:     req.ModelID,
		Description: req.Description,
		IsSystem:    false,
		IsActive:    true,
	}

	tx := config.DB.Begin()

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memulai transaksi.",
		})
		return
	}

	if err := tx.Create(&aiModel).Error; err != nil {
		tx.Rollback()

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal membuat model.",
		})
		return
	}

	// ============================================================
	// LINK MODEL TO AGENTS
	// ============================================================

	for _, agentID := range req.AgentIDs {
		var agent models.Agent

		if err := tx.
			Where(
				"id = ? AND is_active = ?",
				agentID,
				true,
			).
			First(&agent).
			Error; err != nil {
			continue
		}

		link := models.AgentModel{
			AgentID:   agent.ID,
			AIModelID: aiModel.ID,
			IsDefault: false,
		}

		var existing models.AgentModel

		err := tx.
			Where(
				"agent_id = ? AND ai_model_id = ?",
				agent.ID,
				aiModel.ID,
			).
			First(&existing).
			Error

		if err == nil {
			continue
		}

		if err := tx.Create(&link).Error; err != nil {
			tx.Rollback()

			c.JSON(http.StatusInternalServerError, gin.H{
				"ok":    false,
				"error": "Gagal menghubungkan model dengan agent.",
			})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menyimpan model.",
		})
		return
	}

	// ============================================================
	// LOAD RESULT
	// ============================================================

	config.DB.
		Preload("Provider").
		Preload("Agents").
		First(&aiModel, aiModel.ID)

	c.JSON(http.StatusCreated, gin.H{
		"ok":    true,
		"model": aiModel,
	})
}

// ============================================================
// UPDATE AI MODEL
// ============================================================

func UpdateAIModel(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var aiModel models.AIModel

	err := config.DB.
		Where(
			"id = ? AND user_id = ? AND is_system = ?",
			c.Param("id"),
			userID,
			false,
		).
		First(&aiModel).
		Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Model tidak ditemukan.",
		})
		return
	}

	var req updateAIModelRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Data model tidak valid.",
		})
		return
	}

	// ============================================================
	// UPDATE BASIC DATA
	// ============================================================

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)

		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Nama model tidak boleh kosong.",
			})
			return
		}

		aiModel.Name = name
	}

	if req.ModelID != nil {
		modelID := strings.TrimSpace(*req.ModelID)

		if modelID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"ok":    false,
				"error": "Model ID tidak boleh kosong.",
			})
			return
		}

		// Check duplicate if changed.
		var duplicate int64

		err := config.DB.
			Model(&models.AIModel{}).
			Where(`
				provider_id = ?
				AND model_id = ?
				AND id <> ?
				AND deleted_at IS NULL
			`,
				aiModel.ProviderID,
				modelID,
				aiModel.ID,
			).
			Count(&duplicate).
			Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"ok":    false,
				"error": "Gagal memeriksa Model ID.",
			})
			return
		}

		if duplicate > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"ok":    false,
				"error": "Model ID tersebut sudah digunakan.",
			})
			return
		}

		aiModel.ModelID = modelID
	}

	if req.Description != nil {
		aiModel.Description = strings.TrimSpace(
			*req.Description,
		)
	}

	if req.IsActive != nil {
		aiModel.IsActive = *req.IsActive
	}

	// ============================================================
	// TRANSACTION
	// ============================================================

	tx := config.DB.Begin()

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memulai transaksi.",
		})
		return
	}

	if err := tx.Save(&aiModel).Error; err != nil {
		tx.Rollback()

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memperbarui model.",
		})
		return
	}

	// ============================================================
	// UPDATE AGENT RELATIONS
	// ============================================================

	if req.AgentIDs != nil {
		if err := tx.
			Where(
				"ai_model_id = ?",
				aiModel.ID,
			).
			Delete(&models.AgentModel{}).
			Error; err != nil {

			tx.Rollback()

			c.JSON(http.StatusInternalServerError, gin.H{
				"ok":    false,
				"error": "Gagal memperbarui hubungan agent.",
			})
			return
		}

		for _, agentID := range *req.AgentIDs {
			var agent models.Agent

			if err := tx.
				Where(
					"id = ? AND is_active = ?",
					agentID,
					true,
				).
				First(&agent).
				Error; err != nil {
				continue
			}

			link := models.AgentModel{
				AgentID:   agent.ID,
				AIModelID: aiModel.ID,
				IsDefault: false,
			}

			if err := tx.Create(&link).Error; err != nil {
				tx.Rollback()

				c.JSON(http.StatusInternalServerError, gin.H{
					"ok":    false,
					"error": "Gagal menghubungkan model dengan agent.",
				})
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menyimpan perubahan model.",
		})
		return
	}

	// ============================================================
	// LOAD UPDATED MODEL
	// ============================================================

	config.DB.
		Preload("Provider").
		Preload("Agents").
		First(&aiModel, aiModel.ID)

	c.JSON(http.StatusOK, gin.H{
		"ok":    true,
		"model": aiModel,
	})
}

// ============================================================
// REMOVE MODEL FROM ONE AGENT
// ============================================================

func RemoveModelFromAgent(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var req removeModelFromAgentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Format request tidak valid.",
		})
		return
	}

	if req.AgentID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Agent ID wajib diisi.",
		})
		return
	}

	// ============================================================
	// GET MODEL
	// ============================================================

	var aiModel models.AIModel

	err := config.DB.
		Where(
			"id = ? AND user_id = ? AND is_system = ?",
			c.Param("id"),
			userID,
			false,
		).
		First(&aiModel).
		Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Model tidak ditemukan.",
		})
		return
	}

	// ============================================================
	// GET AGENT
	// ============================================================

	var agent models.Agent

	err = config.DB.
		Where(
			"id = ? AND is_active = ?",
			req.AgentID,
			true,
		).
		First(&agent).
		Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Agent tidak ditemukan.",
		})
		return
	}

	// ============================================================
	// REMOVE ONLY THIS RELATION
	// ============================================================

	result := config.DB.
		Where(
			"agent_id = ? AND ai_model_id = ?",
			req.AgentID,
			aiModel.ID,
		).
		Delete(&models.AgentModel{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal melepas model dari agent.",
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Model tersebut tidak terhubung ke agent ini.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"message": "Model berhasil dilepas dari agent.",
	})
}

// ============================================================
// DELETE AI MODEL PERMANENTLY
// ============================================================

func DeleteAIModel(c *gin.Context) {
	userID, ok := getCurrentUserID(c)

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"ok":    false,
			"error": "User tidak ditemukan.",
		})
		return
	}

	var aiModel models.AIModel

	err := config.DB.
		Where(
			"id = ? AND user_id = ? AND is_system = ?",
			c.Param("id"),
			userID,
			false,
		).
		First(&aiModel).
		Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"ok":    false,
			"error": "Model tidak ditemukan.",
		})
		return
	}

	// ============================================================
	// TRANSACTION
	// ============================================================

	tx := config.DB.Begin()

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal memulai transaksi.",
		})
		return
	}

	// ============================================================
	// DELETE ALL RELATIONS
	// ============================================================

	if err := tx.
		Where(
			"ai_model_id = ?",
			aiModel.ID,
		).
		Delete(&models.AgentModel{}).
		Error; err != nil {

		tx.Rollback()

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menghapus hubungan model.",
		})
		return
	}

	// ============================================================
	// DELETE MODEL
	// ============================================================

	if err := tx.Delete(&aiModel).Error; err != nil {
		tx.Rollback()

		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menghapus model.",
		})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"ok":    false,
			"error": "Gagal menyimpan penghapusan model.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"message": "Model berhasil dihapus.",
	})
}
