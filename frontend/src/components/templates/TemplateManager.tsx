/**
 * TemplateManager - Main Template Management Interface
 * Comprehensive template management system for workshops and questionnaires
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilIcon,
  StarIcon,
  EyeIcon,
  ShareIcon,
  HeartIcon,
  BookmarkIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { templateService, templateHelpers } from '../../../src/services/templateService';
import {
  Template,
  TemplateFilter,
  TemplateSearch,
  TemplateSearchResult,
  TemplateCategory,
  TemplateType,
  TemplateStatus,
  TemplateDifficulty,
  SearchSort,
} from '../../../src/types/template';

// Import child components
import { TemplateEditor } from './TemplateEditor';
import { TemplateGallery } from './TemplateGallery';
import { TemplateCustomizer } from './TemplateCustomizer';
import { TemplateSharing } from './TemplateSharing';

interface TemplateManagerProps {
  initialFilter?: TemplateFilter;
  onCreateTemplate?: (type: TemplateType) => void;
  onSelectTemplate?: (template: Template) => void;
  showAnalytics?: boolean;
  mode?: 'full' | 'compact' | 'embedded';
  className?: string;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  initialFilter = {},
  onCreateTemplate,
  onSelectTemplate,
  showAnalytics = false,
  mode = 'full',
  className = '',
}) => {
  // State Management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TemplateFilter>(initialFilter);
  const [sortBy, setSortBy] = useState<SearchSort>('newest');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gallery'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [currentView, setCurrentView] = useState<'browse' | 'create' | 'edit' | 'customize' | 'share'>('browse');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Search and filter state
  const [categories, setCategories] = useState<Record<TemplateCategory, number>>({});
  const [tags, setTags] = useState<Record<string, number>>({});
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);

  // Derived state
  const hasFilters = useMemo(() => {
    return Object.keys(filters).some(key => {
      const value = filters[key as keyof TemplateFilter];
      return value !== undefined && value !== null &&
             (Array.isArray(value) ? value.length > 0 : value !== false);
    });
  }, [filters]);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.title.pl.toLowerCase().includes(query) ||
        template.title.en.toLowerCase().includes(query) ||
        template.description?.pl.toLowerCase().includes(query) ||
        template.description?.en.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.category?.length) {
      filtered = filtered.filter(template => filters.category!.includes(template.category));
    }

    if (filters.type?.length) {
      filtered = filtered.filter(template => filters.type!.includes(template.type));
    }

    if (filters.status?.length) {
      filtered = filtered.filter(template => filters.status!.includes(template.status));
    }

    if (filters.difficulty?.length) {
      filtered = filtered.filter(template => filters.difficulty!.includes(template.difficulty));
    }

    if (filters.duration) {
      filtered = filtered.filter(template =>
        template.estimatedDuration >= filters.duration!.min &&
        template.estimatedDuration <= filters.duration!.max
      );
    }

    if (filters.rating?.min) {
      filtered = filtered.filter(template => template.averageRating >= filters.rating!.min);
    }

    if (filters.language?.length) {
      filtered = filtered.filter(template => filters.language!.includes(template.language));
    }

    if (filters.tags?.length) {
      filtered = filtered.filter(template =>
        filters.tags!.some(tag => template.tags.includes(tag))
      );
    }

    if (filters.featured !== undefined) {
      filtered = filtered.filter(template => template.featured === filters.featured);
    }

    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'popularity':
          return b.usageCount - a.usageCount;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.title.pl.localeCompare(b.title.pl);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, filters, sortBy]);

  // Effects
  useEffect(() => {
    loadTemplates();
    loadCategories();
    loadTags();
  }, []);

  useEffect(() => {
    setShowBulkActions(selectedTemplates.length > 0);
  }, [selectedTemplates]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      debouncedSearch(searchQuery);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery]);

  // Data loading functions
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await templateService.getTemplates(filters, page, 20, sortBy);
      setTemplates(response.data || []);
      setTotalResults(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load templates');
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortBy]);

  const loadCategories = useCallback(async () => {
    try {
      const categoryData = await templateService.getCategories();
      setCategories(categoryData);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const tagData = await templateService.getTags();
      setTags(tagData);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }, []);

  // Search functionality
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      try {
        const suggestions = await templateService.getTemplateSuggestions(query, 5);
        setSearchSuggestions(suggestions.map(t => t.title.pl));
      } catch (error) {
        console.error('Failed to get search suggestions:', error);
      }
    }, 300),
    []
  );

  // Template actions
  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      setCurrentView('edit');
    }
  }, [onSelectTemplate]);

  const handleCreateTemplate = useCallback((type: TemplateType) => {
    if (onCreateTemplate) {
      onCreateTemplate(type);
    } else {
      setCurrentView('create');
    }
  }, [onCreateTemplate]);

  const handleDuplicateTemplate = useCallback(async (template: Template) => {
    try {
      const duplicated = await templateService.duplicateTemplate(template.id, {
        pl: `${template.title.pl} (Copy)`,
        en: `${template.title.en} (Copy)`,
      });

      setTemplates(prev => [duplicated, ...prev]);
      // Show success notification
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      // Show error notification
    }
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await templateService.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setSelectedTemplates(prev => prev.filter(id => id !== templateId));
      // Show success notification
    } catch (error) {
      console.error('Failed to delete template:', error);
      // Show error notification
    }
  }, []);

  const handleToggleFavorite = useCallback(async (templateId: string) => {
    // Implement favorite toggle logic
    // This would likely involve a separate service call
    console.log('Toggle favorite for template:', templateId);
  }, []);

  // Bulk actions
  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Are you sure you want to delete ${selectedTemplates.length} templates?`)) {
      return;
    }

    try {
      await Promise.all(selectedTemplates.map(id => templateService.deleteTemplate(id)));
      setTemplates(prev => prev.filter(t => !selectedTemplates.includes(t.id)));
      setSelectedTemplates([]);
      setShowBulkActions(false);
      // Show success notification
    } catch (error) {
      console.error('Failed to delete templates:', error);
      // Show error notification
    }
  }, [selectedTemplates]);

  const handleBulkExport = useCallback(async () => {
    try {
      const templatesToExport = templates.filter(t => selectedTemplates.includes(t.id));
      // Implement bulk export logic
      console.log('Export templates:', templatesToExport);
    } catch (error) {
      console.error('Failed to export templates:', error);
    }
  }, [selectedTemplates, templates]);

  // Filter management
  const updateFilter = useCallback((key: keyof TemplateFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilter);
    setPage(1);
  }, [initialFilter]);

  const applyFilters = useCallback(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Template operations
  const exportTemplate = useCallback(async (template: Template, format: 'json' | 'pdf' = 'json') => {
    try {
      const blob = await templateService.exportTemplate(template.id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.slug}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export template:', error);
    }
  }, []);

  const shareTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setCurrentView('share');
  }, []);

  // Render helper functions
  const renderTemplateCard = useCallback((template: Template) => {
    const isSelected = selectedTemplates.includes(template.id);

    return (
      <div
        key={template.id}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => handleSelectTemplate(template)}
      >
        {/* Card Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  template.type === 'workshop'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {template.type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${templateHelpers.getDifficultyColor(template.difficulty)}`}>
                  {template.difficulty}
                </span>
                {template.featured && (
                  <StarIconSolid className="w-4 h-4 text-yellow-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {template.title.pl}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {template.description?.pl}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                setSelectedTemplates(prev =>
                  isSelected
                    ? prev.filter(id => id !== template.id)
                    : [...prev, template.id]
                );
              }}
              className="mt-1 ml-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4">
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              <span>{templateHelpers.formatDuration(template.estimatedDuration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              <span>{template.usageCount} uses</span>
            </div>
            <div className="flex items-center gap-1">
              <StarIcon className="w-4 h-4" />
              <span>{template.averageRating.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                +{template.tags.length - 3}
              </span>
            )}
          </div>

          {/* Template Image */}
          {template.imageUrl && (
            <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
              <img
                src={template.imageUrl}
                alt={template.title.pl}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(template.id);
                }}
                className="p-1 text-gray-400 hover:text-yellow-500"
              >
                <HeartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exportTemplate(template);
                }}
                className="p-1 text-gray-400 hover:text-blue-500"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  shareTemplate(template);
                }}
                className="p-1 text-gray-400 hover:text-green-500"
              >
                <ShareIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateTemplate(template);
                }}
                className="p-1 text-gray-400 hover:text-purple-500"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [selectedTemplates, handleSelectTemplate, handleToggleFavorite, exportTemplate, shareTemplate, handleDuplicateTemplate]);

  // Main render
  if (currentView !== 'browse') {
    switch (currentView) {
      case 'create':
      case 'edit':
        return (
          <TemplateEditor
            template={selectedTemplate}
            mode={currentView}
            onClose={() => {
              setCurrentView('browse');
              setSelectedTemplate(null);
            }}
            onSave={() => {
              setCurrentView('browse');
              setSelectedTemplate(null);
              loadTemplates();
            }}
          />
        );
      case 'customize':
        return (
          <TemplateCustomizer
            template={selectedTemplate!}
            onClose={() => {
              setCurrentView('browse');
              setSelectedTemplate(null);
            }}
            onApply={() => {
              setCurrentView('browse');
              setSelectedTemplate(null);
            }}
          />
        );
      case 'share':
        return (
          <TemplateSharing
            template={selectedTemplate!}
            onClose={() => {
              setCurrentView('browse');
              setSelectedTemplate(null);
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className={`template-manager ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
          <p className="text-gray-600">
            Browse, create, and manage workshop and questionnaire templates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('gallery')}
            className={`p-2 rounded-lg ${viewMode === 'gallery' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <ChartBarIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="grid grid-cols-2 gap-1">
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
            </div>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="space-y-0.5">
              <div className="w-4 h-0.5 bg-current rounded-sm"></div>
              <div className="w-4 h-0.5 bg-current rounded-sm"></div>
              <div className="w-4 h-0.5 bg-current rounded-sm"></div>
            </div>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5" />
            Create Template
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setSearchSuggestions([]);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                hasFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {hasFilters && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {Object.values(filters).filter(v =>
                    v !== undefined && v !== null &&
                    (Array.isArray(v) ? v.length > 0 : v !== false)
                  ).length}
                </span>
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SearchSort)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="rating">Highest Rated</option>
              <option value="popularity">Most Popular</option>
              <option value="usage">Most Used</option>
              <option value="name">Name</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {hasFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null;

              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {key}: {Array.isArray(value) ? value.join(', ') : value}
                  <button
                    onClick={() => updateFilter(key as keyof TemplateFilter, undefined)}
                    className="hover:text-blue-900"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filter Templates</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(categories).map(([category, count]) => (
                  <label key={category} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.category?.includes(category as TemplateCategory) || false}
                      onChange={(e) => {
                        const current = filters.category || [];
                        const updated = e.target.checked
                          ? [...current, category as TemplateCategory]
                          : current.filter(c => c !== category);
                        updateFilter('category', updated);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {category} ({count})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="space-y-2">
                {(['workshop', 'questionnaire'] as TemplateType[]).map(type => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.type?.includes(type) || false}
                      onChange={(e) => {
                        const current = filters.type || [];
                        const updated = e.target.checked
                          ? [...current, type]
                          : current.filter(t => t !== type);
                        updateFilter('type', updated);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <div className="space-y-2">
                {(['beginner', 'intermediate', 'advanced', 'expert'] as TemplateDifficulty[]).map(difficulty => (
                  <label key={difficulty} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.difficulty?.includes(difficulty) || false}
                      onChange={(e) => {
                        const current = filters.difficulty || [];
                        const updated = e.target.checked
                          ? [...current, difficulty]
                          : current.filter(d => d !== difficulty);
                        updateFilter('difficulty', updated);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{difficulty}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Duration Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.duration?.min || ''}
                  onChange={(e) => {
                    const min = e.target.value ? parseInt(e.target.value) : undefined;
                    updateFilter('duration', {
                      ...filters.duration,
                      min,
                      max: filters.duration?.max || 300,
                    });
                  }}
                  className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.duration?.max || ''}
                  onChange={(e) => {
                    const max = e.target.value ? parseInt(e.target.value) : undefined;
                    updateFilter('duration', {
                      min: filters.duration?.min || 0,
                      max,
                    });
                  }}
                  className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
              <select
                value={filters.rating?.min || ''}
                onChange={(e) => {
                  const min = e.target.value ? parseFloat(e.target.value) : undefined;
                  updateFilter('rating', { min });
                }}
                className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Any Rating</option>
                <option value="4.5">4.5+ stars</option>
                <option value="4.0">4.0+ stars</option>
                <option value="3.5">3.5+ stars</option>
                <option value="3.0">3.0+ stars</option>
              </select>
            </div>

            {/* Language Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <div className="space-y-2">
                {['pl', 'en', 'both'].map(lang => (
                  <label key={lang} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.language?.includes(lang as any) || false}
                      onChange={(e) => {
                        const current = filters.language || [];
                        const updated = e.target.checked
                          ? [...current, lang as any]
                          : current.filter(l => l !== lang);
                        updateFilter('language', updated);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 uppercase">{lang}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {filteredTemplates.length} templates found
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Clear Filters
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-blue-900 font-medium">
                {selectedTemplates.length} templates selected
              </span>
              <button
                onClick={() => setSelectedTemplates([])}
                className="text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkExport}
                className="px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Export Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading templates...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-red-900 font-medium">Error loading templates</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={loadTemplates}
              className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DocumentDuplicateIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || hasFilters
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first template'
            }
          </p>
          <div className="flex items-center justify-center gap-3">
            {(searchQuery || hasFilters) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  clearFilters();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Clear Search & Filters
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {!loading && !error && filteredTemplates.length > 0 && (
        <>
          {/* View Mode: Gallery */}
          {viewMode === 'gallery' && (
            <TemplateGallery
              templates={filteredTemplates}
              onSelectTemplate={handleSelectTemplate}
              onEditTemplate={(template) => {
                setSelectedTemplate(template);
                setCurrentView('edit');
              }}
              onDuplicateTemplate={handleDuplicateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onShareTemplate={shareTemplate}
              onExportTemplate={exportTemplate}
            />
          )}

          {/* View Mode: Grid */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map(renderTemplateCard)}
            </div>
          )}

          {/* View Mode: List */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="divide-y divide-gray-200">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {template.title.pl}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              template.type === 'workshop'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {template.type}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${templateHelpers.getDifficultyColor(template.difficulty)}`}>
                              {template.difficulty}
                            </span>
                            {template.featured && (
                              <StarIconSolid className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-gray-600 mb-2">{template.description?.pl}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{templateHelpers.formatDuration(template.estimatedDuration)}</span>
                          <span>{template.usageCount} uses</span>
                          <span>{template.averageRating.toFixed(1)} stars</span>
                          <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTemplate(template);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-500"
                        >
                          <DocumentDuplicateIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportTemplate(template);
                          }}
                          className="p-2 text-gray-400 hover:text-green-500"
                        >
                          <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareTemplate(template);
                          }}
                          className="p-2 text-gray-400 hover:text-purple-500"
                        >
                          <ShareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalResults)} of {totalResults} templates
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  const showPage = pageNum <= 3 || pageNum > totalPages - 2 || (pageNum >= page - 1 && pageNum <= page + 1);

                  if (!showPage && pageNum === 3) {
                    return <span key="ellipsis" className="px-2">...</span>;
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 border rounded-lg ${
                        page === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create New Template</h2>
            <div className="space-y-4">
              <button
                onClick={() => {
                  handleCreateTemplate('workshop');
                  setShowCreateModal(false);
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <AcademicCapIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Workshop Template</h3>
                    <p className="text-sm text-gray-600">Create a structured workshop template with sessions, activities, and resources</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  handleCreateTemplate('questionnaire');
                  setShowCreateModal(false);
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DocumentDuplicateIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Questionnaire Template</h3>
                    <p className="text-sm text-gray-600">Create a questionnaire template with questions, logic, and scoring</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility functions
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export default TemplateManager;