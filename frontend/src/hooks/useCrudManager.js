import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "../services/apiClient";

function cloneValues(values) {
  return { ...values };
}

export default function useCrudManager({
  entityLabel,
  service,
  initialValues,
  validate,
  mapEntityToFormValues = (value) => value,
  transformValues = (value) => value,
}) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrefillingForm, setIsPrefillingForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(cloneValues(initialValues));
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function refreshItems({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
    }

    setError("");

    try {
      const nextItems = await service.getAll();
      setItems(nextItems);
      return nextItems;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        `Failed to load ${entityLabel.toLowerCase()} data.`,
      );

      setError(message);
      toast.error(message);
      throw error;
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    refreshItems();
  }, []);

  function handleFieldChange(name, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));

    setFormErrors((currentErrors) => {
      if (!currentErrors[name]) {
        return currentErrors;
      }

      return {
        ...currentErrors,
        [name]: "",
      };
    });
  }

  function closeForm(options = {}) {
    if (isSubmitting && !options.force) {
      return;
    }

    setIsFormOpen(false);
    setIsPrefillingForm(false);
    setEditingId(null);
    setFormMode("create");
    setFormValues(cloneValues(initialValues));
    setFormErrors({});
  }

  function openCreateForm() {
    setFormMode("create");
    setEditingId(null);
    setFormErrors({});
    setFormValues(cloneValues(initialValues));
    setIsFormOpen(true);
  }

  async function openEditForm(id) {
    setFormMode("edit");
    setEditingId(id);
    setFormErrors({});
    setFormValues(cloneValues(initialValues));
    setIsFormOpen(true);
    setIsPrefillingForm(true);

    try {
      const entity = await service.getById(id);
      setFormValues({
        ...cloneValues(initialValues),
        ...mapEntityToFormValues(entity),
      });
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        `Failed to load ${entityLabel.toLowerCase()} details.`,
      );

      toast.error(message);
      setIsFormOpen(false);
      setEditingId(null);
    } finally {
      setIsPrefillingForm(false);
    }
  }

  async function submitForm() {
    const nextErrors = validate(formValues);
    setFormErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return false;
    }

    setIsSubmitting(true);

    try {
      const payload = transformValues(formValues);

      if (formMode === "edit" && editingId) {
        await service.update(editingId, payload);
        toast.success(`${entityLabel} updated successfully.`);
      } else {
        await service.create(payload);
        toast.success(`${entityLabel} created successfully.`);
      }

      closeForm({ force: true });
      await refreshItems({ silent: true });
      return true;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        `Failed to save ${entityLabel.toLowerCase()}.`,
      );

      toast.error(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?._id) {
      return false;
    }

    setIsDeletePending(true);

    try {
      await service.remove(deleteTarget._id);
      toast.success(`${entityLabel} deleted successfully.`);
      setDeleteTarget(null);
      await refreshItems({ silent: true });
      return true;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        `Failed to delete ${entityLabel.toLowerCase()}.`,
      );

      toast.error(message);
      return false;
    } finally {
      setIsDeletePending(false);
    }
  }

  return {
    items,
    error,
    isLoading,
    isSubmitting,
    isDeletePending,
    isFormOpen,
    isPrefillingForm,
    formMode,
    formValues,
    formErrors,
    deleteTarget,
    refreshItems,
    handleFieldChange,
    openCreateForm,
    openEditForm,
    closeForm,
    submitForm,
    setDeleteTarget,
    confirmDelete,
  };
}
