import { useRef, useState } from "react";

// Each member row needs a stable id so React keeps the right input
// when a row in the middle is removed
let nextMemberId = 0;
const newMember = () => ({ id: ++nextMemberId, name: "" });

export default function AddTeamForm({ onAdd, busy }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [members, setMembers] = useState(() => [newMember()]);
  const [focusId, setFocusId] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const nameInput = useRef(null);

  function clearForm() {
    setName("");
    setProject("");
    setMembers([newMember()]);
    setError("");
  }

  function close() {
    clearForm();
    setAdded("");
    setOpen(false);
  }

  function addMemberAfter(index) {
    const member = newMember();
    setMembers((list) => [...list.slice(0, index + 1), member, ...list.slice(index + 1)]);
    setFocusId(member.id);
  }

  function updateMember(id, value) {
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, name: value } : m)));
  }

  function removeMember(id) {
    setMembers((list) => list.filter((m) => m.id !== id));
  }

  // Enter in a member field adds a new row instead of submitting
  function handleMemberKeyDown(event, index) {
    if (event.key === "Enter") {
      event.preventDefault();
      addMemberAfter(index);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setAdded("");
    const teamName = name.trim();
    if (!teamName) return setError("Enter a team name.");

    try {
      await onAdd({
        name: teamName,
        project: project.trim(),
        members: members.map((m) => m.name.trim()).filter(Boolean),
      });
      // Stay open so several teams can be added in a row
      clearForm();
      setAdded(`Added ${teamName}.`);
      nameInput.current?.focus();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!open) {
    return (
      <button className="btn btn--dashed" onClick={() => setOpen(true)}>
        + Add a team
      </button>
    );
  }

  return (
    <form className="add-team" onSubmit={handleSubmit} noValidate>
      <h3>Add a team</h3>

      <label>
        Team name
        <input
          ref={nameInput}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          maxLength={60}
          autoFocus
        />
      </label>

      <label>
        <span>
          Project <span className="optional">(optional)</span>
        </span>
        <input value={project} onChange={(e) => setProject(e.target.value)} maxLength={120} />
      </label>

      <fieldset className="add-team__members">
        <legend>
          Members <span className="optional">(optional)</span>
        </legend>

        {members.length === 0 && <p className="hint">No members added.</p>}

        {members.map((member, index) => (
          <div className="member-row" key={member.id}>
            <input
              value={member.name}
              onChange={(e) => updateMember(member.id, e.target.value)}
              onKeyDown={(e) => handleMemberKeyDown(e, index)}
              placeholder={`Member ${index + 1}`}
              aria-label={`Member ${index + 1}`}
              maxLength={60}
              autoFocus={member.id === focusId}
            />
            <button
              type="button"
              className="remove-btn"
              onClick={() => removeMember(member.id)}
              aria-label={`Remove member ${index + 1}`}
              title="Remove member"
            >
              ×
            </button>
          </div>
        ))}

        <button type="button" className="btn btn--dashed btn--small" onClick={() => addMemberAfter(members.length - 1)}>
          + Add member
        </button>
        <p className="hint">Tip: press Enter in a member field to add another.</p>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {added && (
        <p className="form-success" role="status">
          {added}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Add team
        </button>
        <button type="button" className="btn btn--quiet" onClick={close}>
          Close
        </button>
      </div>
    </form>
  );
}
