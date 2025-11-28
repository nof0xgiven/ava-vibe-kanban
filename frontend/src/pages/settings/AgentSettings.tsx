import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { JSONEditor } from '@/components/ui/json-editor';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

import { ExecutorConfigForm } from '@/components/ExecutorConfigForm';
import { useProfiles } from '@/hooks/useProfiles';
import { useUserSystem } from '@/components/ConfigProvider';
import { CreateConfigurationDialog } from '@/components/dialogs/settings/CreateConfigurationDialog';
import { DeleteConfigurationDialog } from '@/components/dialogs/settings/DeleteConfigurationDialog';
import type { BaseCodingAgent, ExecutorConfigs, ReviewConfig } from 'shared/types';
import { DEFAULT_REVIEW_CONFIG } from '@/types/review';

type ExecutorsMap = Record<string, Record<string, Record<string, unknown>>>;

export function AgentSettings() {
  const { t } = useTranslation('settings');
  // Use profiles hook for server state
  const {
    profilesContent: serverProfilesContent,
    profilesPath,
    isLoading: profilesLoading,
    isSaving: profilesSaving,
    error: profilesError,
    save: saveProfiles,
  } = useProfiles();

const { config, updateAndSaveConfig, reloadSystem, profiles } = useUserSystem();

  // Review config from central config (not localStorage)
  const reviewConfig: ReviewConfig = config?.review ?? DEFAULT_REVIEW_CONFIG;

  // Local editor state (draft that may differ from server)
  const [localProfilesContent, setLocalProfilesContent] = useState('');
  const [profilesSuccess, setProfilesSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form-based editor state
  const [useFormEditor, setUseFormEditor] = useState(true);
  const [selectedExecutorType, setSelectedExecutorType] =
    useState<BaseCodingAgent>('CLAUDE_CODE' as BaseCodingAgent);
  const [selectedConfiguration, setSelectedConfiguration] =
    useState<string>('DEFAULT');
  const [localParsedProfiles, setLocalParsedProfiles] =
    useState<ExecutorConfigs | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Sync server state to local state when not dirty
  useEffect(() => {
    if (!isDirty && serverProfilesContent) {
      setLocalProfilesContent(serverProfilesContent);
      // Parse JSON inside effect to avoid object dependency
      try {
        const parsed = JSON.parse(serverProfilesContent);
        setLocalParsedProfiles(parsed);
      } catch (err) {
        console.error('Failed to parse profiles JSON:', err);
        setLocalParsedProfiles(null);
      }
    }
  }, [serverProfilesContent, isDirty]);

  // Sync raw profiles with parsed profiles
  const syncRawProfiles = (profiles: unknown) => {
    setLocalProfilesContent(JSON.stringify(profiles, null, 2));
  };

  // Mark profiles as dirty
  const markDirty = (nextProfiles: unknown) => {
    setLocalParsedProfiles(nextProfiles as ExecutorConfigs);
    syncRawProfiles(nextProfiles);
    setIsDirty(true);
  };

  // Open create dialog
  const openCreateDialog = async () => {
    try {
      const result = await CreateConfigurationDialog.show({
        executorType: selectedExecutorType,
        existingConfigs: Object.keys(
          localParsedProfiles?.executors?.[selectedExecutorType] || {}
        ),
      });

      if (result.action === 'created' && result.configName) {
        createConfiguration(
          selectedExecutorType,
          result.configName,
          result.cloneFrom
        );
      }
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  // Create new configuration
  const createConfiguration = (
    executorType: string,
    configName: string,
    baseConfig?: string | null
  ) => {
    if (!localParsedProfiles || !localParsedProfiles.executors) return;

    const executorsMap =
      localParsedProfiles.executors as unknown as ExecutorsMap;
    const base =
      baseConfig && executorsMap[executorType]?.[baseConfig]?.[executorType]
        ? executorsMap[executorType][baseConfig][executorType]
        : {};

    const updatedProfiles = {
      ...localParsedProfiles,
      executors: {
        ...localParsedProfiles.executors,
        [executorType]: {
          ...executorsMap[executorType],
          [configName]: {
            [executorType]: base,
          },
        },
      },
    };

    markDirty(updatedProfiles);
    setSelectedConfiguration(configName);
  };

  // Open delete dialog
  const openDeleteDialog = async (configName: string) => {
    try {
      const result = await DeleteConfigurationDialog.show({
        configName,
        executorType: selectedExecutorType,
      });

      if (result === 'deleted') {
        await handleDeleteConfiguration(configName);
      }
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  // Handle delete configuration
  const handleDeleteConfiguration = async (configToDelete: string) => {
    if (!localParsedProfiles) {
      return;
    }

    // Clear any previous errors
    setSaveError(null);

    try {
      // Validate that the configuration exists
      if (
        !localParsedProfiles.executors[selectedExecutorType]?.[configToDelete]
      ) {
        return;
      }

      // Check if this is the last configuration
      const currentConfigs = Object.keys(
        localParsedProfiles.executors[selectedExecutorType] || {}
      );
      if (currentConfigs.length <= 1) {
        return;
      }

      // Remove the configuration from the executor
      const remainingConfigs = {
        ...localParsedProfiles.executors[selectedExecutorType],
      };
      delete remainingConfigs[configToDelete];

      const updatedProfiles = {
        ...localParsedProfiles,
        executors: {
          ...localParsedProfiles.executors,
          [selectedExecutorType]: remainingConfigs,
        },
      };

      const executorsMap = updatedProfiles.executors as unknown as ExecutorsMap;
      // If no configurations left, create a blank DEFAULT (should not happen due to check above)
      if (Object.keys(remainingConfigs).length === 0) {
        executorsMap[selectedExecutorType] = {
          DEFAULT: { [selectedExecutorType]: {} },
        };
      }

      try {
        // Save using hook
        await saveProfiles(JSON.stringify(updatedProfiles, null, 2));

        // Update local state and reset dirty flag
        setLocalParsedProfiles(updatedProfiles);
        setLocalProfilesContent(JSON.stringify(updatedProfiles, null, 2));
        setIsDirty(false);

        // Select the next available configuration
        const nextConfigs = Object.keys(
          executorsMap[selectedExecutorType] || {}
        );
        const nextSelected = nextConfigs[0] || 'DEFAULT';
        setSelectedConfiguration(nextSelected);

        // Show success
        setProfilesSuccess(true);
        setTimeout(() => setProfilesSuccess(false), 3000);

        // Refresh global system so deleted configs are removed elsewhere
        reloadSystem();
      } catch (saveError: unknown) {
        console.error('Failed to save deletion to backend:', saveError);
        setSaveError(t('settings.agents.errors.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting configuration:', error);
    }
  };

  const handleProfilesChange = (value: string) => {
    setLocalProfilesContent(value);
    setIsDirty(true);

    // Validate JSON on change
    if (value.trim()) {
      try {
        const parsed = JSON.parse(value);
        setLocalParsedProfiles(parsed);
      } catch (err) {
        // Invalid JSON, keep local content but clear parsed
        setLocalParsedProfiles(null);
      }
    }
  };

  const handleSaveProfiles = async () => {
    // Clear any previous errors
    setSaveError(null);

    try {
      const contentToSave =
        useFormEditor && localParsedProfiles
          ? JSON.stringify(localParsedProfiles, null, 2)
          : localProfilesContent;

      await saveProfiles(contentToSave);
      setProfilesSuccess(true);
      setIsDirty(false);
      setTimeout(() => setProfilesSuccess(false), 3000);

      // Update the local content if using form editor
      if (useFormEditor && localParsedProfiles) {
        setLocalProfilesContent(contentToSave);
      }

      // Refresh global system so new profiles are available elsewhere
      reloadSystem();
    } catch (err: unknown) {
      console.error('Failed to save profiles:', err);
      setSaveError(t('settings.agents.errors.saveFailed'));
    }
  };

  const handleExecutorConfigChange = (
    executorType: string,
    configuration: string,
    formData: unknown
  ) => {
    if (!localParsedProfiles || !localParsedProfiles.executors) return;

    const executorsMap =
      localParsedProfiles.executors as unknown as ExecutorsMap;
    // Update the parsed profiles with the new config
    const updatedProfiles = {
      ...localParsedProfiles,
      executors: {
        ...localParsedProfiles.executors,
        [executorType]: {
          ...executorsMap[executorType],
          [configuration]: {
            [executorType]: formData,
          },
        },
      },
    };

    markDirty(updatedProfiles);
  };

  const handleExecutorConfigSave = async (formData: unknown) => {
    if (!localParsedProfiles || !localParsedProfiles.executors) return;

    // Clear any previous errors
    setSaveError(null);

    // Update the parsed profiles with the saved config
    const updatedProfiles = {
      ...localParsedProfiles,
      executors: {
        ...localParsedProfiles.executors,
        [selectedExecutorType]: {
          ...localParsedProfiles.executors[selectedExecutorType],
          [selectedConfiguration]: {
            [selectedExecutorType]: formData,
          },
        },
      },
    };

    // Update state
    setLocalParsedProfiles(updatedProfiles);

    // Save the updated profiles directly
    try {
      const contentToSave = JSON.stringify(updatedProfiles, null, 2);

      await saveProfiles(contentToSave);
      setProfilesSuccess(true);
      setIsDirty(false);
      setTimeout(() => setProfilesSuccess(false), 3000);

      // Update the local content as well
      setLocalProfilesContent(contentToSave);

      // Refresh global system so new profiles are available elsewhere
      reloadSystem();
    } catch (err: unknown) {
      console.error('Failed to save profiles:', err);
      setSaveError(t('settings.agents.errors.saveConfigFailed'));
    }
  };

  const handleReviewConfigChange = async (updates: Partial<ReviewConfig>) => {
    if (!config) return;
    const updatedReview = { ...reviewConfig, ...updates };
    try {
      await updateAndSaveConfig({ ...config, review: updatedReview });
    } catch (err) {
      console.error('Failed to save review config:', err);
      setSaveError(t('settings.agents.errors.saveConfigFailed'));
    }
  };

  if (profilesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('settings.agents.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!!profilesError && (
        <Alert variant="destructive">
          <AlertDescription>
            {profilesError instanceof Error
              ? profilesError.message
              : String(profilesError)}
          </AlertDescription>
        </Alert>
      )}

      {profilesSuccess && (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {t('settings.agents.save.success')}
          </AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.agents.review.title', { defaultValue: 'Review Settings' })}</CardTitle>
          <CardDescription>
            {t('settings.agents.review.description', { defaultValue: 'Configure automatic code review when tasks move to In Review status.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-review toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-review">
                {t('settings.agents.review.autoReviewLabel', { defaultValue: 'Enable Auto-Review' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.agents.review.autoReviewDescription', { defaultValue: 'Automatically start review when task moves to In Review' })}
              </p>
            </div>
            <Switch
              id="auto-review"
              checked={reviewConfig.auto_review_enabled}
              onCheckedChange={(checked) => handleReviewConfigChange({ auto_review_enabled: checked })}
            />
          </div>

          {/* Review profile selector */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-same-agent"
                checked={reviewConfig.review_profile === null}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleReviewConfigChange({ review_profile: null });
                  } else if (profiles?.executors) {
                    // Set to first available profile
                    const firstExecutor = Object.keys(profiles.executors)[0] as BaseCodingAgent;
                    if (firstExecutor) {
                      handleReviewConfigChange({
                        review_profile: { executor: firstExecutor, variant: null }
                      });
                    }
                  }
                }}
              />
              <Label htmlFor="use-same-agent">
                {t('settings.agents.review.useSameAgentLabel', { defaultValue: 'Use same agent as coding tasks' })}
              </Label>
            </div>
            {reviewConfig.review_profile !== null && profiles?.executors && (
              <Select
                value={reviewConfig.review_profile?.executor ?? ''}
                onValueChange={(value) => {
                  handleReviewConfigChange({
                    review_profile: { executor: value as BaseCodingAgent, variant: null }
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.agents.review.selectAgentPlaceholder', { defaultValue: 'Select review agent' })} />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(profiles.executors).map((executor) => (
                    <SelectItem key={executor} value={executor}>
                      {executor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Include in follow-up toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-followup">
                {t('settings.agents.review.includeFollowUpLabel', { defaultValue: 'Include in Follow-up' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.agents.review.includeFollowUpDescription', { defaultValue: 'Include review feedback in follow-up prompts by default' })}
              </p>
            </div>
            <Switch
              id="include-followup"
              checked={reviewConfig.include_in_follow_up}
              onCheckedChange={(checked) => handleReviewConfigChange({ include_in_follow_up: checked })}
            />
          </div>

          {/* Max retries */}
          <div className="space-y-2">
            <Label htmlFor="max-retries">
              {t('settings.agents.review.maxRetriesLabel', { defaultValue: 'Maximum Retries' })}
            </Label>
            <Input
              id="max-retries"
              type="number"
              min={0}
              max={5}
              value={reviewConfig.max_retries}
              onChange={(e) => handleReviewConfigChange({ max_retries: parseInt(e.target.value, 10) || 0 })}
              className="w-24"
            />
            <p className="text-sm text-muted-foreground">
              {t('settings.agents.review.maxRetriesDescription', { defaultValue: 'Number of automatic retry attempts if review fails (0-5)' })}
            </p>
          </div>

          {/* Custom prompt template */}
          <div className="space-y-2">
            <Label htmlFor="prompt-template">
              {t('settings.agents.review.promptLabel', { defaultValue: 'Custom Prompt Template (Optional)' })}
            </Label>
            <Textarea
              id="prompt-template"
              placeholder={t('settings.agents.review.promptPlaceholder', { defaultValue: 'Enter custom instructions for the review agent...' })}
              value={reviewConfig.prompt_template || ''}
              onChange={(e) => handleReviewConfigChange({ prompt_template: e.target.value || null })}
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              {t('settings.agents.review.promptDescription', { defaultValue: 'Custom instructions appended to the review prompt. Leave empty for default behavior.' })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.agents.title')}</CardTitle>
          <CardDescription>{t('settings.agents.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Editor type toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use-form-editor"
              checked={!useFormEditor}
              onCheckedChange={(checked) => setUseFormEditor(!checked)}
              disabled={profilesLoading || !localParsedProfiles}
            />
            <Label htmlFor="use-form-editor">
              {t('settings.agents.editor.formLabel')}
            </Label>
          </div>

          {useFormEditor &&
          localParsedProfiles &&
          localParsedProfiles.executors ? (
            // Form-based editor
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="executor-type">
                    {t('settings.agents.editor.agentLabel')}
                  </Label>
                  <Select
                    value={selectedExecutorType}
                    onValueChange={(value) => {
                      setSelectedExecutorType(value as BaseCodingAgent);
                      // Reset configuration selection when executor type changes
                      setSelectedConfiguration('DEFAULT');
                    }}
                  >
                    <SelectTrigger id="executor-type">
                      <SelectValue
                        placeholder={t(
                          'settings.agents.editor.agentPlaceholder'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(localParsedProfiles.executors).map(
                        (type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="configuration">
                    {t('settings.agents.editor.configLabel')}
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedConfiguration}
                      onValueChange={(value) => {
                        if (value === '__create__') {
                          openCreateDialog();
                        } else {
                          setSelectedConfiguration(value);
                        }
                      }}
                      disabled={
                        !localParsedProfiles.executors[selectedExecutorType]
                      }
                    >
                      <SelectTrigger id="configuration">
                        <SelectValue
                          placeholder={t(
                            'settings.agents.editor.configPlaceholder'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(
                          localParsedProfiles.executors[selectedExecutorType] ||
                            {}
                        ).map((configuration) => (
                          <SelectItem key={configuration} value={configuration}>
                            {configuration}
                          </SelectItem>
                        ))}
                        <SelectItem value="__create__">
                          {t('settings.agents.editor.createNew')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-10"
                      onClick={() => openDeleteDialog(selectedConfiguration)}
                      disabled={
                        profilesSaving ||
                        !localParsedProfiles.executors[selectedExecutorType] ||
                        Object.keys(
                          localParsedProfiles.executors[selectedExecutorType] ||
                            {}
                        ).length <= 1
                      }
                      title={
                        Object.keys(
                          localParsedProfiles.executors[selectedExecutorType] ||
                            {}
                        ).length <= 1
                          ? t('settings.agents.editor.deleteTitle')
                          : t('settings.agents.editor.deleteButton', {
                              name: selectedConfiguration,
                            })
                      }
                    >
                      {t('settings.agents.editor.deleteText')}
                    </Button>
                  </div>
                </div>
              </div>

              {(() => {
                const executorsMap =
                  localParsedProfiles.executors as unknown as ExecutorsMap;
                return (
                  !!executorsMap[selectedExecutorType]?.[
                    selectedConfiguration
                  ]?.[selectedExecutorType] && (
                    <ExecutorConfigForm
                      executor={selectedExecutorType}
                      value={
                        (executorsMap[selectedExecutorType][
                          selectedConfiguration
                        ][selectedExecutorType] as Record<string, unknown>) ||
                        {}
                      }
                      onChange={(formData) =>
                        handleExecutorConfigChange(
                          selectedExecutorType,
                          selectedConfiguration,
                          formData
                        )
                      }
                      onSave={handleExecutorConfigSave}
                      disabled={profilesSaving}
                      isSaving={profilesSaving}
                      isDirty={isDirty}
                    />
                  )
                );
              })()}
            </div>
          ) : (
            // Raw JSON editor
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profiles-editor">
                  {t('settings.agents.editor.jsonLabel')}
                </Label>
                <JSONEditor
                  id="profiles-editor"
                  placeholder={t('settings.agents.editor.jsonPlaceholder')}
                  value={
                    profilesLoading
                      ? t('settings.agents.editor.jsonLoading')
                      : localProfilesContent
                  }
                  onChange={handleProfilesChange}
                  disabled={profilesLoading}
                  minHeight={300}
                />
              </div>

              {!profilesError && profilesPath && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {t('settings.agents.editor.pathLabel')}
                    </span>{' '}
                    <span className="font-mono text-xs">{profilesPath}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!useFormEditor && (
        <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-sm border-t py-4">
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfiles}
              disabled={!isDirty || profilesSaving || !!profilesError}
            >
              {profilesSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('settings.agents.save.button')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
